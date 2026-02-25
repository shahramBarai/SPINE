import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.guid
from shapely.geometry import Polygon
from shapely.ops import unary_union
import json
from rdflib import Graph, Literal, Namespace, RDF, RDFS, OWL
import uuid
from pathlib import Path

# Configuration of Namespaces for RDF graph
BRICK = Namespace("https://brickschema.org/schema/Brick#")
BOT = Namespace("https://w3id.org/bot#")
INST = Namespace("https://lbd.example.com/")
PROPS = Namespace("http://lbd.arch.rwth-aachen.de/props#") 

PREFIXES = {
    "brick": BRICK, "bot": BOT, "inst": INST, "rdfs": RDFS, "owl": OWL, "props": PROPS
    }

def initialize_graph():        
    g = Graph()
    for p, ns in PREFIXES.items(): g.bind(p, ns)
    return g

def add_system_instances(graph, ifc_model):
    """
    Add system instances from an IFC model to a graph.
    """            
    systems = ifc_model.by_type("IfcSystem")
    for system in systems:
        system_uuid = uuid.UUID(ifcopenshell.guid.expand(system.GlobalId))
        system_uri = INST[f"system_{system_uuid}"]
        graph.add((system_uri, RDF.type, BRICK.System))
        graph.add((system_uri, RDFS.label, Literal(system.Name)))
        graph.add((system_uri, PROPS.descriptionIfcRoot_attribute_simple, Literal(system.Description)))
        graph.add((system_uri, PROPS.globalIdIfcRoot_attribute_simple, Literal(system.GlobalId)))
        graph.add((system_uri, OWL.sameAs, INST[f"ifcSystem_{system.id()}"]))
    added_systems = len(systems)
    print(f"Added {added_systems} systems from IFC model to the graph.")      
                
    return graph, added_systems

def add_links_to_system(graph, ifc_model, ttl_file):
    """
    Add links between system instances and their related objects from an IFC model and a TTL file without systems to a graph.
    """ 
    # Link systems to their related objects using IfcRelAssignsToGroup
    relations = ifc_model.by_type("IfcRelAssignsToGroup")
    graph_ttl = Graph()
    graph_ttl.parse(ttl_file, format="ttl")
    num_objects_linked = 0
    for rel in relations:
        if rel.RelatingGroup.is_a("IfcSystem"):
            system_guid_literal = Literal(rel.RelatingGroup.GlobalId)            
            system_uri = next(
            graph.subjects(PROPS.globalIdIfcRoot_attribute_simple, system_guid_literal),
                None
            )
            if system_uri is None:
                print(f"No system found for GlobalId: {rel.RelatingGroup.GlobalId}")
            for related_object in rel.RelatedObjects:
                object_guid_literal = Literal(related_object.GlobalId)
                object_uri = next(
                    graph_ttl.subjects(PROPS.globalIdIfcRoot_attribute_simple, object_guid_literal),
                    None
                )
                if object_uri is None:
                    print(f"No object found for GlobalId: {related_object.GlobalId}")
                
                if system_uri is not None:
                    graph.add((system_uri, BRICK.hasPart, object_uri))
                    num_objects_linked += 1    
    print(f"Linked {num_objects_linked} objects to systems.")  

    return graph, num_objects_linked 

def save_graph_to_file(graph, output_filename):
    graph.serialize(destination=output_filename, format="turtle")
    print(f"Final graph saved to {output_filename}")

def pair_ifc_and_ttl(ifc_folder_path, ttl_folder_path):
    """
    Scans two folders and returns a list of tuples: (path_to_ifc, path_to_ttl).
    Only returns pairs where the base filename matches.
    """
    ifc_dir = Path(ifc_folder_path)
    ttl_dir = Path(ttl_folder_path)

    # 1. Get all IFC files and map {filename_stem: full_path}
    # .stem returns the filename without extension (e.g., "house.ifc" -> "house")
    ifc_files = {f.stem: f for f in ifc_dir.glob("*.ifc")}
    
    # 2. Get all TTL files and map {filename_stem: full_path}
    ttl_files = {f.stem: f for f in ttl_dir.glob("*.ttl")}

    pairs = []
    missing_ttl = []
    missing_ifc = []

    # 3. Iterate through IFC files to find matching TTLs
    for name, ifc_path in ifc_files.items():
        if name in ttl_files:
            ttl_path = ttl_files[name]
            pairs.append((ifc_path, ttl_path))
        else:
            missing_ttl.append(name)

    # Optional: Check for TTLs that don't have an IFC
    for name in ttl_files:
        if name not in ifc_files:
            missing_ifc.append(name)

    return pairs, missing_ttl, missing_ifc

def link_system_ifc_ttl(ifc_folder, ttl_folder):#, output_file):
    matched_pairs, no_ttl, no_ifc = pair_ifc_and_ttl(ifc_folder, ttl_folder)
    
    print(f"Found {len(matched_pairs)} matching pairs of IFC and TTL files.")
    if no_ttl:
        print(f"Warning: {len(no_ttl)} IFC files have no matching TTL: {no_ttl}")
    if no_ifc:
        print(f"Warning: {len(no_ifc)} TTL files have no matching IFC: {no_ifc}")
    
    g = initialize_graph()
    added_systems_count = 0
    added_links_count = 0
    for ifc_path, ttl_path in matched_pairs:
        print(f"\nProcessing pair:\n  IFC: {ifc_path}\n  TTL: {ttl_path}")        
        ifc_model = ifcopenshell.open(ifc_path)
        g, added_systems = add_system_instances(g, ifc_model)
        added_systems_count += added_systems
        g, num_objects_linked = add_links_to_system(g, ifc_model, ttl_path)
        added_links_count += num_objects_linked
    print(f"Total systems added: {added_systems_count}")
    print(f"Total links added: {added_links_count}")
    print(f"Final graph has {len(g)} triples.")
    #save_graph_to_file(g, output_file)
    return g

# HELPER: Get Exact 2D Footprint & Z-Range ---
def get_element_geometry(element, settings):
    """
    Returns (Polygon, min_z, max_z) for an element.
    Uses unary_union of mesh faces for exact footprint generation
    instead of convex_hull to preserve L-shapes, U-shapes, and concavities.
    """
    try:
        shape = ifcopenshell.geom.create_shape(settings, element)
        verts = shape.geometry.verts # Flat list [x, y, z, x, y, z...]
        
        # Also extract the faces (indices of vertices forming triangles)
        faces = shape.geometry.faces # Flat list [v1, v2, v3, v1, v2, v3...]
        
        # Group vertices into (x, y, z) tuples
        points_3d = [(verts[i], verts[i+1], verts[i+2]) for i in range(0, len(verts), 3)]

        if not points_3d: 
            return None, 0, 0

        # Build individual 2D triangles from the mesh faces
        triangles = []
        for i in range(0, len(faces), 3):
            # Get the 3D points for this specific triangle
            p1 = points_3d[faces[i]]
            p2 = points_3d[faces[i+1]]
            p3 = points_3d[faces[i+2]]
            
            # Create a 2D Shapely polygon by ignoring the Z coordinate (index 2)
            tri = Polygon([(p1[0], p1[1]), (p2[0], p2[1]), (p3[0], p3[1])])
            
            # Filter out invalid or purely vertical faces (which have 0 area in 2D)
            if tri.is_valid and tri.area > 1e-6:
                triangles.append(tri)

        # Merge all valid triangles into one exact footprint polygon
        if not triangles:
            return None, 0, 0
        poly = unary_union(triangles)
        
        # Get Vertical Extents (Z)
        zs = [p[2] for p in points_3d]
        min_z, max_z = min(zs), max(zs)
        
        return poly, min_z, max_z

    except Exception as e:
        print(f"Failed to extract geometry for element {element.GlobalId}: {e}")
        return None, 0, 0

# --- 2. HELPER: Group Elements by Storey ---
def map_elements_to_storeys(ifc_file, element_types):
    """
    Returns dict: { 'Storey Name + Elevation': [List of Elements] }
    """
    mapping = {}
    #ifc = ifcopenshell.open(ifc_file)
    storeys = ifc_file.by_type("IfcBuildingStorey")
    
    for storey in storeys:
        elements = []
        # Check Spatial Containment (Walls/Coverings)
        for element_type in element_types:
            if hasattr(storey, "ContainsElements"):
                for rel in storey.ContainsElements:
                    for elem in rel.RelatedElements:
                        if elem.is_a(element_type):
                            elements.append(elem)
            
            # Check Aggregation (Spaces/Zones)
            if hasattr(storey, "IsDecomposedBy"):
                for rel in storey.IsDecomposedBy:
                    for obj in rel.RelatedObjects:
                        if obj.is_a(element_type):
                            elements.append(obj)

        if elements:
            mapping[f"{storey.Name} ({int(storey.Elevation+0.5)})"] = elements
            
    return mapping

# --- 3. MAIN FUNCTION ---
def check_intersections_optimized(src_ifc_path, tgt_ifc_path, src_types, tgt_type, tolerance_mm=0):
    tolerance_m = tolerance_mm / 1000.0
    print(f"Starting Optimized Check (Tolerance: {tolerance_mm}mm)...")
    
    # Load Files
    src_ifc = ifcopenshell.open(src_ifc_path)
    tgt_ifc = ifcopenshell.open(tgt_ifc_path)
    #print(f"Loaded Source IFC: {src_ifc_path} with {len(src_ifc.by_type('IfcBuildingStorey'))} storeys.")
    #print(f"Loaded Target IFC: {tgt_ifc_path} with {len(tgt_ifc.by_type('IfcBuildingStorey'))} storeys.")
    
    # Settings (World Coords are critical)
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)

    # A. Group by Storey
    print("Grouping elements by storey...")
    src_map = map_elements_to_storeys(src_ifc, src_types)
    tgt_map = map_elements_to_storeys(tgt_ifc, tgt_type)
    
    results = {}
    
    # B. Iterate Storey by Storey
    prefixes_lower = ("a", "b", "c", "d")
    # --- STEP 1: INDEX ARCHITECTURE BY ELEVATION ---
    # We create a temporary dictionary: { "3000": [List of Spaces], "6000": [...] }
    # This allows us to find spaces even if the Storey Name is different.
    tgt_spaces_by_elev = {}
    for key, spaces_list in tgt_map.items():
        # Extract "3000" from "Level 1 (3000)"
        # rsplit finds the LAST '(' to avoid issues if the name itself has parentheses
        elev_str = key.rsplit('(', 1)[1].rstrip(')') 
        tgt_spaces_by_elev[elev_str] = spaces_list

    # --- STEP 2: ITERATE SRC AND MATCH ---
    for src_key, src_elements in src_map.items():
        
        # Extract elevation from SRC key: "L01 (3000)" -> "3000"
        src_elev = src_key.rsplit('(', 1)[1].rstrip(')')
        
        # Check if this elevation exists in our new TGT Index
        if src_elev not in tgt_spaces_by_elev:
            print(f"Skipping '{src_key}' (No matching Spaces found at elevation {src_elev}).")
            continue
            
        # SUCCESS: We found the matching spaces!
        spaces = tgt_spaces_by_elev[src_elev]
        # Select spaces with names starting with A-D (optional filter)        
        spaces = [
                s for s in spaces
                if (
                    s.Name
                    and s.Name[0].lower() in prefixes_lower
                    and s.GlobalId != "2eKm1MRbj9lQ$fk6CjSQZn" # Exclude the repeated space A1502
                )
            ]
        
        # Extract the original name for print/debug clarity
        src_storey_name = src_key.rsplit(' (', 1)[0]
        
        print(f"Processing Storey {src_storey_name} (Elev {src_elev}): {len(src_elements)} Elements vs {len(spaces)} Spaces")    

        # C. Pre-calculate Geometry for Spaces on this floor
        # We cache this so we don't re-calculate space geometry for every covering
        space_geoms = []
        for space in spaces:
            poly, min_z, max_z = get_element_geometry(space, settings)
            if poly:
                space_geoms.append({
                    "guid": space.GlobalId,
                    "poly": poly,
                    "min_z": min_z,
                    "max_z": max_z
                })        

        # D. Check Elements on this floor
        for ele in src_elements:
            ele_poly, ele_min_z, ele_max_z = get_element_geometry(ele, settings)
            
            if not ele_poly: continue

            # Filter: Is the space below the covering?
            for space_data in space_geoms:
                
                # --- VERTICAL CHECK ---
                vertical_gap = ele_min_z - space_data['max_z']
                
                is_vertically_aligned = False
                if 0 < vertical_gap <= tolerance_m:
                    is_vertically_aligned = True # Floating just above
                elif vertical_gap <= 0 and ele_max_z > space_data['min_z']:
                    is_vertically_aligned = True # Clashing / Inside

                if not is_vertically_aligned:
                    continue

                # --- 2D CHECK (Shapely) ---
                if ele_poly.intersects(space_data['poly']):
                    # Optional: Check overlap area
                    overlap = ele_poly.intersection(space_data['poly']).area
                    if overlap > 0.01: # >100cm² overlap
                        
                        # --- KEY CHANGE HERE ---
                        # Instead of collecting spaces, we immediately register 
                        # this element to the matching space.
                        
                        s_guid = space_data['guid']
                        ele_guid = ele.GlobalId
                        
                        # If this space hasn't been hit yet, create a new list
                        if s_guid not in results:
                            results[s_guid] = []
                        
                        # Add this element to the space's list
                        results[s_guid].append(ele_guid)

    return results

def link_terminals_to_spaces(spaces_ttl, elements_ttl, system_graph, intersections):
    """
    For each space in intersections, link it to the terminals using BOT.hasElement.
    """
    g = system_graph
    graph = Graph()    
    graph.parse(spaces_ttl, format="ttl")
    graph.parse(elements_ttl, format="ttl")
    linked_count = 0  
    for space_guid, terminal_guids in intersections.items():
        space_uri = next(
            graph.subjects(PROPS.globalIdIfcRoot_attribute_simple, Literal(space_guid)),
            None
        )
        if space_uri is None:
            print(f"Warning: No URI found for space with GUID {space_guid}")
            continue
        
        for t_guid in terminal_guids:
            terminal_uri = next(
                graph.subjects(PROPS.globalIdIfcRoot_attribute_simple, Literal(t_guid)),
                None
            )
            if terminal_uri is None:
                print(f"Warning: No URI found for terminal with GUID {t_guid}")
                continue
            
            g.add((space_uri, BOT.hasElement, terminal_uri))
            linked_count += 1
    print(f"Linked {linked_count} terminals to spaces in the graph.")
    return g

def link_mep_system_ttl(mep_ifc_folder, mep_ttl_folder, arc_ifc_path, arc_ttl, mep_ifc_types, save_path):
    """
    Main function to link MEP IFC files to their corresponding TTL files and associate terminals with spaces.
    For each space in intersections, link it to the terminals using BOT.hasElement.
    """
    # Link systems to spaces based on spatial intersections
    graph_systems = link_system_ifc_ttl(mep_ifc_folder, mep_ttl_folder)
    # Link terminals to spaces based on spatial intersections
    processed_ifc_count = 0
    matched_pairs, no_ttl, no_ifc = pair_ifc_and_ttl(mep_ifc_folder, mep_ttl_folder)    
    for ifc_path, ttl_path in matched_pairs:
        print(f"Processing pair:\n  IFC: {ifc_path}\n  TTL: {ttl_path}")
        intersections = check_intersections_optimized(ifc_path, arc_ifc_path, mep_ifc_types, ["IfcSpace"], tolerance_mm=0)
        link_terminals_to_spaces(arc_ttl, ttl_path, graph_systems, intersections)
        processed_ifc_count += 1
    print(f"Processed {processed_ifc_count}/{len(matched_pairs)} IFC files.\n")
    print(f"\n✅ Processed {processed_ifc_count} MEP IFC files and linked terminals to spaces.")
    
    save_graph_to_file(graph_systems, save_path)

# --- Execution ---
if __name__ == "__main__":   
    mep_types = ["IfcFlowTerminal", "IfcFlowController", "IfcDistributionControlElement", "IfcEnergyConversionDevice", "IfcFlowMovingDevice", "IfcFlowStorageDevice","IfcFlowTreatmentDevice"] 
    hvac_ifc_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\IFC\03LVI"   
    hvac_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\03LVI" 
    el_ifc_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\IFC\04SAHKO"   
    el_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\04SAHKO"       
    arc_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\IFC\01ARK\ARK_MET.ifc"
    arc_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\01ARK\ARK_MET.ttl"

    # --- HVAC ---
    hvac_link_ttl_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_lvi_systems_elements.ttl"
    link_mep_system_ttl(hvac_ifc_folder, hvac_ttl_folder, arc_path, arc_ttl, mep_types, hvac_link_ttl_path)

    # --- ELECTRICAL ---
    el_link_ttl_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_sahko_systems_elements.ttl"
    link_mep_system_ttl(el_ifc_folder, el_ttl_folder, arc_path, arc_ttl, mep_types, el_link_ttl_path)

    
    
