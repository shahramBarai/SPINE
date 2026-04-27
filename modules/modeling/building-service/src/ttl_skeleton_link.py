"""
name: ttl_link_skeleton.py
description: Linking model skeletons(site,building,storey) extracted from TTL files.
"""

import rdflib
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, OWL, RDFS
from difflib import SequenceMatcher
from pprint import pprint
import ifcopenshell
from pathlib import Path
from graph_manager import init_graph, save_graph, BRICK, BOT, PROPS, S223


# Helper to populate dictionary
def add_to_skeleton(graph, rdf_type, target_dict):
    for s in graph.subjects(RDF.type, rdf_type):
        # Use label or name for site and building
        if rdf_type in [BOT.Site, BOT.Building]:
            label_literal = graph.value(s, RDFS.label)
            label = str(label_literal) if label_literal else None 
            if s not in target_dict:
                target_dict[s] = label
        elif rdf_type == BOT.Storey:
            elevation_str = graph.value(s, PROPS.elevationIfcBuildingStorey_attribute_simple)
            elevation = round(float(elevation_str), 3) if elevation_str else None
            # Keep parent building context so storey matches can be grouped under sub-buildings.
            parent_building = None
            for candidate_building in graph.subjects(BOT.hasStorey, s):
                if (candidate_building, RDF.type, BOT.Building) in graph:
                    parent_building = candidate_building
                    break
            if parent_building is None:
                for candidate_building in graph.subjects(BOT.containsZone, s):
                    if (candidate_building, RDF.type, BOT.Building) in graph:
                        parent_building = candidate_building
                        break
            if s not in target_dict:
                target_dict[s] = {
                    'elevation': elevation,
                    'building': parent_building
                }
    


def extract_bot_skeleton(ttl_file_path):
    print(f"Parsing {ttl_file_path}...")
    g = Graph()
    g.parse(ttl_file_path, format="ttl")
    
    skeleton = {
        'sites': {}, 'buildings': {}, 'storeys': {}
    }    
    # Extract all levels
    add_to_skeleton(g, BOT.Site, skeleton['sites'])
    add_to_skeleton(g, BOT.Building, skeleton['buildings'])
    add_to_skeleton(g, BOT.Storey, skeleton['storeys'])    

    print(f"  Found: {len(skeleton['sites'])} Sites, {len(skeleton['buildings'])} Bldgs, "
          f"{len(skeleton['storeys'])} Storeys")
    return skeleton


def match_skeletons(arch_data, eng_data): 
    # Matching sites and buildings with one-to-one and one-to-parts assumption, and storeys based on elevation (as the anchor) with a tolerance of 0.5m.   
    print("Matching skeletons... ")          
    matches = []
    matched_storeys_count = 0
    # 1. Match Sites and Buildings
    if len(arch_data['sites'])==1:
        if len(eng_data['sites'])==1:
            for a_uri, a_name in arch_data['sites'].items():
                for e_uri, e_name in eng_data['sites'].items():
                    matches.append((a_uri, OWL.sameAs, e_uri))
                    print(f"MATCH: Site '{a_name}' == '{e_name}'")
        elif len(eng_data['sites'])>1:
            print("\nWarning: Multiple sites found in engineering model. Using bot:containsZone relationships to link the single architectural site to all engineering sites.")
            for a_uri, a_name in arch_data['sites'].items():
                for e_uri, e_name in eng_data['sites'].items():
                    matches.append((a_uri, BOT.containsZone, e_uri))
                    print(f"MATCH: Site '{a_name}' P^{-1} x$ '{e_name}'")

                
    if len(arch_data['buildings'])==1:
        if len(eng_data['buildings'])==1:
            for a_uri, a_name in arch_data['buildings'].items():
                for e_uri, e_name in eng_data['buildings'].items():
                    matches.append((a_uri, OWL.sameAs, e_uri))
                    print(f"MATCH: Building '{a_name}' == '{e_name}'")
        elif len(eng_data['buildings'])>1:
            print("\nWarning: Multiple buildings found in engineering model. Using bot:containsZone relationships to link the single architectural building to all engineering buildings.")
            for a_uri, a_name in arch_data['buildings'].items():
                for e_uri, e_name in eng_data['buildings'].items():
                    matches.append((a_uri, BOT.containsZone, e_uri))
                    print(f"MATCH: Building '{a_name}' P^{-1} x$ '{e_name}'")
    
    # 2. Match Storeys (The Anchor)
    print("\n--- Aligning Storeys ---")
    ELEVATION_TOLERANCE = 0.5  # m

    # Guard: check whether the engineering model has meaningful elevation variance.
    # If all storeys share the same elevation value the property carries no spatial
    # information and elevation-based matching would produce false positives.
    eng_elevations = [
        (v['elevation'] if isinstance(v, dict) else v)
        for v in eng_data['storeys'].values()
        if (v['elevation'] if isinstance(v, dict) else v) is not None
    ]
    if len(set(eng_elevations)) <= 1:
        print(
            f"Warning: Engineering model storeys have no meaningful elevation variance "
            f"(all values = {eng_elevations[0] if eng_elevations else 'None'}). "
            "Skipping storey matching to avoid false positives."
        )
        return matches

    for a_uri, a_storey in arch_data['storeys'].items():
        a_ele = a_storey['elevation'] if isinstance(a_storey, dict) else a_storey
        matched_eng_storeys = []

        if a_ele is None:
            continue  # Cannot anchor a storey without elevation data

        for e_uri, e_storey in eng_data['storeys'].items():
            e_ele = e_storey['elevation'] if isinstance(e_storey, dict) else e_storey
            if e_ele is None:
                continue
            # Match by elevation with a strict ±0.5 m tolerance.
            if abs(e_ele - a_ele) <= ELEVATION_TOLERANCE:
                matched_eng_storeys.append(e_uri)

        if len(matched_eng_storeys) == 1:
            matches.append((a_uri, OWL.sameAs, matched_eng_storeys[0]))
            matched_storeys_count += 1
            print(f"MATCH: Storey on level '{a_ele}'")
        elif len(matched_eng_storeys) > 1:
            for e_uri in matched_eng_storeys:
                matches.append((a_uri, BOT.containsZone, e_uri))
            matched_storeys_count += len(matched_eng_storeys)
            print(
                f"MATCH: Storey on level '{a_ele}' contains {len(matched_eng_storeys)} engineering sub-storeys"
            )

    if matched_storeys_count > 0:
        print(f"\nTotal matched storeys: {matched_storeys_count}")   
                
    else:
        print("\nWarning: No storeys matched. Aborting Site/Building linkage to avoid false positives.")
    
    return matches


def link_file_skeletons(matches, output_file):
    # This function can be expanded to link elements across skeletons based on spatial or semantic relationships
    print("\nLinking Skeletons...")
    linkset = init_graph()
    print(f"\n--- Generating {output_file} ---")
    for arch_uri, relation, eng_uri in matches:
        linkset.add((arch_uri, relation, eng_uri))

    save_graph(linkset, output_file)


def link_folder_skeletons(arc_ttl_file, mep_ttl_folder, output_file):
    mep_ttl_files = list(Path(mep_ttl_folder).glob("*.ttl"))
    mep_matches = []
    arc_data = extract_bot_skeleton(arc_ttl_file)
    for ttl_file in mep_ttl_files:
        if "ifcowl" in ttl_file.name.lower():  # Skip non-BOT files
            print(f"Skipping non-BOT file: {ttl_file.name}")
            continue
        mep_data = extract_bot_skeleton(ttl_file)
        matches = match_skeletons(arc_data, mep_data)
        print(f"Matches for {ttl_file.name}: {len(matches)}")
        mep_matches.extend(matches)
    link_file_skeletons(mep_matches, output_file)

# --- Execution ---
if __name__ == "__main__":     
    rak_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\02RAK"
    hvac_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\03LVI"     
    el_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\04SAHKO"    
    arc_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\01ARK\ARK_MET.ttl"

    arc_data = extract_bot_skeleton(arc_ttl)

    # --- STRUCTURE ---
    rak_skeleton_link_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_rak_skeleton.ttl"
    link_folder_skeletons(arc_ttl, rak_ttl_folder, rak_skeleton_link_ttl)  

    # --- HVAC ---
    hvac_skeleton_link_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_lvi_skeleton.ttl"
    #link_folder_skeletons(arc_ttl, hvac_ttl_folder, hvac_skeleton_link_ttl)  

    # --- ELECTRICAL ---
    el_skeleton_link_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_sahko_skeleton.ttl"
    #link_folder_skeletons(arc_ttl, el_ttl_folder, el_skeleton_link_ttl)    

