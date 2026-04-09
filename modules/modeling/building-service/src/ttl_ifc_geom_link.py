"""
name: ttl_ifc_geom_link.py
description: Link IFC instances based on their geometry with TTL files, focusing on spatial relationships like adjacency. Uses exact geometry extraction and R-Tree indexing for efficient linking of spaces, walls, and MEP components.
"""

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.guid
import ifcopenshell.util
import ifcopenshell.util.element
import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
from rdflib import Graph, Literal, Namespace, RDF, RDFS, OWL
from pathlib import Path
from rtree import index
import trimesh
from itertools import combinations
from pprint import pprint
import plotly.graph_objects as go
from collections import defaultdict, Counter
from graph_manager import init_graph, save_graph, BRICK, BOT, PROPS, S223, FSO
from ttl_ifc_system_link import pair_ifc_and_ttl

# Configuration 
# IFC types of MEP components to be linked
mep_types = ['IfcEnergyConversionDevice',
 'IfcFlowController',
 'IfcFlowFitting',
 'IfcFlowMovingDevice',
 'IfcFlowSegment',
 'IfcFlowTerminal',
 'IfcFlowTreatmentDevice',
 'IfcBuildingElementProxy']

# --------------------------------------------------
# 1️⃣ Geometry Settings
# --------------------------------------------------

def create_geometry_settings():
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    return settings

# --------------------------------------------------
# 2️⃣ Get Spaces Grouped by Storey
# --------------------------------------------------

def get_spaces_by_storey(ifc):
    """
    Fetches Spaces grouped by Building Storey.
    Uses 'IsDecomposedBy' -> 'IfcRelAggregates'
    """
    storey_spaces = {}
    prefixes_lower = ("a", "b", "c", "d")

    for storey in ifc.by_type("IfcBuildingStorey"):
        spaces = []
        
        # Spaces are AGGREGATED into storeys
        if hasattr(storey, "IsDecomposedBy"):
            for rel in storey.IsDecomposedBy:
                if rel.is_a("IfcRelAggregates"):
                    for obj in rel.RelatedObjects:
                        if obj.is_a("IfcSpace"):
                            # Apply the specific naming and exclusion rules
                            if obj.Name and obj.Name[0].lower() in prefixes_lower:
                                if obj.GlobalId != "2eKm1MRbj9lQ$fk6CjSQZn":  
                                    spaces.append(obj)
                                    
        storey_spaces[storey.GlobalId] = spaces

    return storey_spaces

def get_walls_by_storey(ifc):
    """
    Fetches Walls grouped by Building Storey.
    Uses 'ContainsElements' -> 'IfcRelContainedInSpatialStructure'
    Handles both IfcWall and IfcWallStandardCase.
    """
    storey_walls = {}

    for storey in ifc.by_type("IfcBuildingStorey"):
        walls = []
        
        # Walls are CONTAINED in storeys
        if hasattr(storey, "ContainsElements"):
            for rel in storey.ContainsElements:
                if rel.is_a("IfcRelContainedInSpatialStructure"):
                    # Note: Contained elements are under 'RelatedElements', not 'RelatedObjects'
                    for obj in rel.RelatedElements:
                        if obj.is_a("IfcWall") or obj.is_a("IfcWallStandardCase"):
                            walls.append(obj)
                            
        storey_walls[storey.GlobalId] = walls

    return storey_walls


# --------------------------------------------------
# 3️⃣ Extract 2D Footprint Polygon From Space
# --------------------------------------------------
def get_product_polygon(product, settings, simplify_tolerance=0.001):
    """
    Extracts the exact 2D footprint of an IfcEntity.
    Natively preserves concavities and internal holes by unioning mesh faces.
    """
    try:
        # Generate 3D shape from IFC element
        shape = ifcopenshell.geom.create_shape(settings, product)
        verts = shape.geometry.verts  # Flat list: [x1, y1, z1, x2, y2, z2...]
        faces = shape.geometry.faces  # Flat list: [v1, v2, v3, v1, v2, v3...]
        
        # Group vertices into 2D (x, y) tuples directly, dropping Z
        points_2d = [(verts[i], verts[i+1]) for i in range(0, len(verts), 3)]

        if not points_2d:
            return None

        triangles = []
        
        # Reconstruct 2D triangles from the mesh faces
        for i in range(0, len(faces), 3):
            p1 = points_2d[faces[i]]
            p2 = points_2d[faces[i+1]]
            p3 = points_2d[faces[i+2]]
            
            tri = Polygon([p1, p2, p3])
            
            # Filter out purely vertical faces (walls) which have ~0 area in 2D
            if tri.is_valid and tri.area > 1e-6:
                triangles.append(tri)

        if not triangles:
            return None
            
        # Union merges all triangles. Shapely automatically 
        # detects the outer boundary and hollows out the interiors (holes).
        exact_poly = unary_union(triangles)
        
        # Clean up any self-intersections or bowtie polygons 
        # that sometimes occur when flattening complex 3D meshes.
        if not exact_poly.is_valid:
            exact_poly = exact_poly.buffer(0)
            
        # Simplify straight edges. Removing collinear vertices 
        # dramatically speeds up the .buffer() and .intersects() math later.
        # (Assuming model in meters; use ~1.0 if model is in millimeters).
        if simplify_tolerance > 0:
            exact_poly = exact_poly.simplify(simplify_tolerance, preserve_topology=True)
        
        return exact_poly

    except Exception as e:
        print(f"Failed to extract geometry for product {product.GlobalId}: {e}")
        return None


# --------------------------------------------------
# 4️⃣ Detect Adjacency Using Polygon Contact
# --------------------------------------------------


def polygons_adjacent(poly1, poly2, tolerance=0.2):
    """
    Checks if two polygons are adjacent.
    Uses direct area calculation to filter out corner touches, 
    which is exponentially faster than generating bounding boxes.
    """
    if poly1 is None or poly2 is None:
        return False

    # (Keep this!) If they are further apart than the tolerance, skip the heavy math entirely.
    if poly1.distance(poly2) > tolerance:
        return False

    buf1 = poly1.buffer(tolerance)
    buf2 = poly2.buffer(tolerance)

    # Calculate the exact overlapping polygon(s)
    overlap = buf1.intersection(buf2)

    if overlap.is_empty:
        return False

    # Simply check if the total overlap area exceeds your threshold.
    min_intersection_area = (tolerance*2) ** 2
    # This natively handles MultiPolygons (disconnected chunks) because Shapely 
    # sums the area of all parts automatically.
    return overlap.area >= min_intersection_area


# --------------------------------------------------
# 5️⃣ Compute Adjacency For One Storey
# --------------------------------------------------

def compute_space_adjacency(spaces, settings, tolerance=0.2):

    polygons = {}

    for space in spaces:
        polygons[space.GlobalId] = get_product_polygon(space, settings)

    adjacency = set()

    for s1, s2 in combinations(spaces, 2):
        poly1 = polygons[s1.GlobalId]
        poly2 = polygons[s2.GlobalId]

        if polygons_adjacent(poly1, poly2, tolerance):
            # Sort the GlobalIds so (A, B) and (B, A) become identical
            unique_pair = tuple(sorted([s1.GlobalId, s2.GlobalId]))
            adjacency.add(unique_pair)

    return adjacency

# --------------------------------------------------
# Compute Space-to-Wall Adjacency
# --------------------------------------------------
def compute_space_wall_adjacency(spaces, walls, settings, tolerance=0.2):
    """
    Compares a list of spaces against a list of walls to find adjacencies.
    """
    adjacency = set()
    
    # Pre-calculate polygons to avoid redundant processing
    space_polys = {s.GlobalId: get_product_polygon(s, settings) for s in spaces}
    wall_polys = {w.GlobalId: get_product_polygon(w, settings) for w in walls}

    # Compare every space against every wall
    for space in spaces:
        for wall in walls:
            poly_s = space_polys[space.GlobalId]
            poly_w = wall_polys[wall.GlobalId]

            if polygons_adjacent(poly_s, poly_w, tolerance):
                # Sort the GlobalIds so (Space, Wall) and (Wall, Space) are handled uniformly
                unique_pair = tuple(sorted([space.GlobalId, wall.GlobalId]))
                adjacency.add(unique_pair)

    return adjacency


# --------------------------------------------------
# 6️⃣ Full IFC Adjacency Extraction
# --------------------------------------------------

def compute_arc_ifc_adjacency(ifc_path, tolerance=0.2):

    ifc = ifcopenshell.open(ifc_path)
    settings = create_geometry_settings()

    storey_spaces = get_spaces_by_storey(ifc)
    storey_walls = get_walls_by_storey(ifc)

    # Use a master set to prevent cross-storey duplication
    all_adjacencies = set()

    for storey_id, spaces in storey_spaces.items():
        # Get walls for this specific storey (default to empty list if none exist)
        walls = storey_walls.get(storey_id, [])
        
        # 1. Calculate Space-to-Space Adjacencies
        if len(spaces) >= 2:
            storey_space_adj = compute_space_adjacency(spaces, settings, tolerance)
            all_adjacencies.update(storey_space_adj)

        # 2. Calculate Space-to-Wall Adjacencies
        if len(spaces) > 0 and len(walls) > 0:
            storey_space_wall_adj = compute_space_wall_adjacency(spaces, walls, settings, tolerance)
            all_adjacencies.update(storey_space_wall_adj)

    # Convert the final clean set back to a list for output
    return list(all_adjacencies)


def link_spaces_walls(arc_ttl, adjacencies):
    """
    For paired spaces, link them using BOT.adjacentZone.
    For links of spaces to walls using BOT.adjacentElement.
    """
    g = init_graph()
        
    graph = Graph()    
    graph.parse(arc_ttl, format="ttl")    
    
    linked_spaces_count = 0  
    linked_walls_count = 0 

    for (guid_0, guid_1) in adjacencies:
        # 1. Fetch URI for the first GUID
        uri_0 = next(
            graph.subjects(PROPS.globalIdIfcRoot_attribute_simple, Literal(guid_0)),
            None
        )
        if uri_0 is None:
            print(f"Warning: No URI found for GUID {guid_0}")
            continue

        # 2. Fetch URI for the second GUID
        uri_1 = next(
            graph.subjects(PROPS.globalIdIfcRoot_attribute_simple, Literal(guid_1)),
            None
        )
        if uri_1 is None:
            print(f"Warning: No URI found for GUID {guid_1}")
            continue

        # Determine the type of each URI to route to the correct BOT property
        type_0_uri = next(graph.objects(uri_0, RDF.type), None)
        type_1_uri = next(graph.objects(uri_1, RDF.type), None)
        
        # Safely convert to lowercase string to check if "space" is in the class name (e.g., IfcSpace)
        is_space_0 = type_0_uri and "space" in str(type_0_uri).lower()
        is_space_1 = type_1_uri and "space" in str(type_1_uri).lower()

        # Apply appropriate BOT relation based on types
        if is_space_0 and is_space_1:
            # Both are spaces
            g.add((uri_0, BOT.adjacentZone, uri_1))
            linked_spaces_count += 1
            
        elif is_space_0 and not is_space_1:
            # uri_0 is the Space, uri_1 is the Wall
            # Note: bot:adjacentElement strictly goes from Zone to Element
            g.add((uri_0, BOT.adjacentElement, uri_1))
            linked_walls_count += 1
            
        elif not is_space_0 and is_space_1:
            # uri_1 is the Space, uri_0 is the Wall
            g.add((uri_1, BOT.adjacentElement, uri_0))
            linked_walls_count += 1
            
        else:
            # (Optional) Both are walls; ignore or handle if needed
            pass

    print(f"Linked {linked_spaces_count} adjacent spaces (bot:adjacentZone).")
    print(f"Linked {linked_walls_count} space-to-wall boundaries (bot:adjacentElement).") 
    
    return g

# --------------------------------------------------
# 1️⃣ Extract Exact 3D Mesh & Bounding Box
# --------------------------------------------------
def get_3d_mesh_data(product, settings):
    """
    Extracts the exact 3D triangles from the IFC product and builds a Trimesh object.
    Also returns the bounding box for fast pre-filtering.
    """
    try:
        shape = ifcopenshell.geom.create_shape(settings, product)
        verts = shape.geometry.verts
        faces = shape.geometry.faces
        
        # Group flat list of vertices into (x, y, z) tuples
        vertices_3d = [(verts[i], verts[i+1], verts[i+2]) for i in range(0, len(verts), 3)]
        
        # Group flat list of faces into (v1, v2, v3) tuples
        faces_3d = [(faces[i], faces[i+1], faces[i+2]) for i in range(0, len(faces), 3)]
        
        if not vertices_3d:
            return None

        # Build the exact 3D mesh
        mesh = trimesh.Trimesh(vertices=vertices_3d, faces=faces_3d)
        
        # Trimesh automatically calculates the bounding box bounds!
        # bounds looks like: [[min_x, min_y, min_z], [max_x, max_y, max_z]]
        bounds = mesh.bounds 
        
        return {
            "mesh": mesh,
            "min_x": bounds[0][0], "min_y": bounds[0][1], "min_z": bounds[0][2],
            "max_x": bounds[1][0], "max_y": bounds[1][1], "max_z": bounds[1][2]
        }
    except Exception as e:
        print(f"Geometry failed for {product.GlobalId}: {e}")
        return None


def mep_elements_by_system(ifc):    
    systems = {}
    relations = ifc.by_type("IfcRelAssignsToGroup")
    for rel in relations:
        if rel.RelatingGroup.is_a("IfcSystem"):
            system = rel.RelatingGroup
            components = list(rel.RelatedObjects)
            systems[system.GlobalId] = components            
    return systems


# --------------------------------------------------
# 1️⃣ Build the 3D Search Engine (R-Tree)
# --------------------------------------------------
def compute_mep_adjacencies(mep_elements, settings, tolerance=0.05):
    """
    Finds all adjacencies across the entire MEP network regardless of storey.
    Uses an R-Tree for O(n log n) broad-phase sorting, followed by exact mesh checks.
    """
    # 1. Configure R-Tree for 3 Dimensions (X, Y, Z)
    p = index.Property()
    p.dimension = 3
    idx = index.Index(properties=p)
    
    # 2. Extract data and populate the index
    print(f"Extracting geometry for {len(mep_elements)} MEP elements...")
    mep_data_list = []
    
    for i, element in enumerate(mep_elements):
        data = get_3d_mesh_data(element, settings) # (Using the function from the previous step)
        if data is None:
            mep_data_list.append(None)
            continue
            
        data["global_id"] = element.GlobalId
        mep_data_list.append(data)
        
        # Insert the 3D bounding box into the R-Tree using the list index 'i' as the ID
        idx.insert(i, (data["min_x"], data["min_y"], data["min_z"],
                       data["max_x"], data["max_y"], data["max_z"]))

    # 3. Query the index to find actual adjacencies
    print("Searching for connections...")
    adjacencies = set()
    collision_manager = trimesh.collision.CollisionManager()

    for i, data1 in enumerate(mep_data_list):
        if data1 is None:
            continue
            
        # Expand the search box slightly by the tolerance to catch gaps
        search_box = (
            data1["min_x"] - tolerance, data1["min_y"] - tolerance, data1["min_z"] - tolerance,
            data1["max_x"] + tolerance, data1["max_y"] + tolerance, data1["max_z"] + tolerance
        )
        
        # BROAD PHASE: Ask the R-Tree who is nearby (happens instantly)
        candidates = list(idx.intersection(search_box))
        
        for j in candidates:
            # Prevent comparing an object to itself, and prevent checking (A, B) then (B, A)
            if i >= j:
                continue
                
            data2 = mep_data_list[j]
            if data2 is None:
                continue

            # NARROW PHASE: Exact 3D mesh distance check
            collision_manager.add_object('part1', data1["mesh"])
            distance = collision_manager.min_distance_single(data2["mesh"])
            collision_manager.remove_object('part1') # clean up manager for next loop
            
            if distance is not None and distance <= tolerance:
                # We found a verified connection!
                unique_pair = tuple(sorted([data1["global_id"], data2["global_id"]]))
                adjacencies.add(unique_pair)

    return list(adjacencies)


def get_all_system_adjacencies(ifc, settings, tolerance=0.05):
    # 1. Group elements using your custom function
    systems_dict = mep_elements_by_system(ifc)
    
    # Use a global set to prevent duplicates (in case two elements 
    # somehow belong to multiple of the same systems)
    all_adjacencies = set()
    
    # 2. Loop through each isolated system
    for system_id, elements in systems_dict.items():
        print(f"Processing System {system_id} ({len(elements)} items)...")
        
        # Skip empty systems or systems with only 1 item (cannot have adjacencies)
        if len(elements) < 2:
            continue
            
        # 3. Run the original, fast R-Tree script purely on this isolated list
        system_adjacencies = compute_mep_adjacencies(
            elements, 
            settings, 
            tolerance
        )
        
        # Add the results to our master list
        all_adjacencies.update(system_adjacencies)
        
    return list(all_adjacencies)


def link_mep_components(graph, mep_ttl, adjacencies):
    """
    For paired MEP components, link them using FSO.connectedWith.
    The directions are not in the model, using symmetric relations.
    """            
    graph_read = Graph()    
    graph_read.parse(mep_ttl, format="ttl")    
    
    linked_components_count = 0     

    for (guid_0, guid_1) in adjacencies:
        # 1. Fetch URI for the first GUID
        uri_0 = next(
            graph_read.subjects(PROPS.globalIdIfcRoot_attribute_simple, Literal(guid_0)),
            None
        )
        if uri_0 is None:
            print(f"Warning: No URI found for GUID {guid_0}")
            continue

        # 2. Fetch URI for the second GUID
        uri_1 = next(
            graph_read.subjects(PROPS.globalIdIfcRoot_attribute_simple, Literal(guid_1)),
            None
        )
        if uri_1 is None:
            print(f"Warning: No URI found for GUID {guid_1}")
            continue
        
        graph.add((uri_1, FSO.connectedWith, uri_0))
        linked_components_count += 1
                    
    print(f"Linked {linked_components_count} adjacent MEP components (fso:connectedWith).") 
    
    return graph


def get_connected_runs(pairs):
    """
    Takes a list of connected pairs and returns a list of grouped tuples,
    where each tuple represents a fully connected run of elements.
    """
    # 1. Build the "Network" (Adjacency List)
    # This maps every element to everything it touches.
    graph = defaultdict(set)
    for a, b in pairs:
        graph[a].add(b)
        graph[b].add(a)

    visited = set()
    connected_runs = []

    # 2. Walk through the network to group the components (DFS)
    for node in graph:
        if node not in visited:
            # We found a new, unvisited element. Let's trace its entire run.
            current_run = []
            stack = [node]
            
            while stack:
                current = stack.pop()
                if current not in visited:
                    visited.add(current)
                    current_run.append(current)
                    
                    # Add all unvisited neighbors to the stack to check next
                    unvisited_neighbors = graph[current] - visited
                    stack.extend(unvisited_neighbors)
            
            # Save the completed run
            connected_runs.append(tuple(current_run))

    return connected_runs


def visualize_ifc_elements(ifc, guids):
    """
    Takes a list of GUIDs, extracts their 3D meshes, assigns them distinct colors,
    and renders them all together in an interactive Jupyter Plotly scene.
    """    
    
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    
    # A vibrant palette of colors to cycle through for distinction
    color_palette = [
        '#EF553B', '#636EFA', '#00CC96', '#AB63FA', '#FFA15A', 
        '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'
    ]

    # Helper function to convert IFC shape to Trimesh
    def get_trimesh(element):
        try:
            shape = ifcopenshell.geom.create_shape(settings, element)
            verts = shape.geometry.verts
            faces = shape.geometry.faces
            
            vertices_3d = [(verts[i], verts[i+1], verts[i+2]) for i in range(0, len(verts), 3)]
            faces_3d = [(faces[i], faces[i+1], faces[i+2]) for i in range(0, len(faces), 3)]
            
            return trimesh.Trimesh(vertices=vertices_3d, faces=faces_3d)
        except Exception as e:
            print(f"Failed to generate geometry for {element.GlobalId}: {e}")
            return None

    # Initialize the Plotly figure
    fig = go.Figure()
    success_count = 0

    # Loop through the list of GUIDs
    for guid in guids:
        element = ifc.by_id(guid)
        
        if not element:
            print(f"Warning: GUID {guid} not found in the file.")
            continue

        mesh = get_trimesh(element)
        if not mesh:
            print(f"Warning: Missing geometry for {guid}.")
            continue

        # Automatically assign a color from the palette based on the current count
        color = color_palette[success_count % len(color_palette)]
        
        # Add the 3D mesh to the scene
        fig.add_trace(go.Mesh3d(
            x=mesh.vertices[:, 0], y=mesh.vertices[:, 1], z=mesh.vertices[:, 2],
            i=mesh.faces[:, 0], j=mesh.faces[:, 1], k=mesh.faces[:, 2],
            color=color, opacity=0.6, 
            name=f"{element.is_a()} ({guid})", # Shows up in the legend
            hoverinfo='name' # Shows the element type and GUID when you hover your mouse
        ))
        
        success_count += 1

    if success_count == 0:
        print("No elements were successfully processed.")
        return

    # Keep proportions realistic and add a title
    fig.update_layout(
        scene_aspectmode='data',
        title=f"Visualizing {success_count} IFC Elements",
        margin=dict(l=0, r=0, b=0, t=40),
        legend=dict(x=0, y=1) # Move legend to the top left so it doesn't block the view
    )
    
    fig.show()

def link_arc_spaces_walls_save(arc_ifc_path, arc_ttl_path, save_path, tolerance=0.2):   
    """
    Main function to link spaces and walls from architecture model.    
    """ 
    adjacencies = compute_arc_ifc_adjacency(arc_ifc_path, tolerance)
    space_wall_links = link_spaces_walls(arc_ttl_path, adjacencies)
    save_graph(space_wall_links, save_path)


def link_mep_components_save(mep_ifc_folder, mep_ttl_folder, save_folder, tolerance=0.05):
    """
    Main function to link MEP components based on IFC files and their corresponding TTL files.
    For each components in intersections, link them using FSO.connectedWith.
    """
    graph = init_graph()
    processed_ifc_count = 0
    matched_pairs, no_ttl, no_ifc = pair_ifc_and_ttl(mep_ifc_folder, mep_ttl_folder)    
    for ifc_path, ttl_path in matched_pairs:
        print(f"Processing pair:\n  IFC: {ifc_path}\n  TTL: {ttl_path}")
        mep_ifc = ifcopenshell.open(ifc_path)        
        #mep_elements = []
        #for mep_type in mep_types:
        #    mep_elements.extend(mep_ifc.by_type(mep_type))
        #print(f"Total MEP elements found: {len(mep_elements)}")
        settings = create_geometry_settings()
        #adjacencies = compute_mep_adjacencies(mep_elements, settings, tolerance)
        #adjacencies = compute_mep_adjacencies_by_system(mep_ifc, mep_elements, settings, tolerance)
        adjacencies = get_all_system_adjacencies(mep_ifc, settings, tolerance)
        print(f"Total MEP adjacencies found: {len(adjacencies)}")
        link_mep_components(graph, ttl_path, adjacencies)        
        processed_ifc_count += 1

        save_file_name = Path(ttl_path).stem + "_connected.ttl"
        save_path = save_folder + "\\" + save_file_name

        save_graph(graph, save_path)

    print(f"Processed {processed_ifc_count}/{len(matched_pairs)} IFC files.\n")
    print(f"\n✅ Processed {processed_ifc_count} MEP IFC files and linked adjacent components.")

if __name__ == "__main__":
    # Link architecture spaces and walls
    arc_ifc_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\IFC\01ARK\ARK_MET.ifc"
    arc_ttl_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\01ARK\ARK_MET.ttl"
    arc_save_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_spaces_walls.ttl"
    
    #link_arc_spaces_walls_save(arc_ifc_path, arc_ttl_path, arc_save_path, tolerance=0.2)

    # Link MEP components
    hvac_ifc_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\IFC\03LVI"   
    hvac_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\03LVI" 
    el_ifc_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\IFC\04SAHKO"   
    el_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\04SAHKO"   

    save_folder = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset"  

    link_mep_components_save(hvac_ifc_folder, hvac_ttl_folder, save_folder, tolerance=0.05) # Link HVAC components
    link_mep_components_save(el_ifc_folder, el_ttl_folder, save_folder, tolerance=0.05) # Link electricity components
