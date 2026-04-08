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
            elevation = int(float(elevation_str)+0.5) if elevation_str else "Unknown"
            if s not in target_dict:
                target_dict[s] = elevation
    


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


def match_skeletons(arch_data, mep_data):    
    print("Matching skeletons... ")       
    matches = []
    matched_storeys_count = 0
    # 1. Match Sites and Buildings
    if len(arch_data['sites'])==1 and len(mep_data['sites'])==1:
        for a_uri, a_name in arch_data['sites'].items():
            for m_uri, m_name in mep_data['sites'].items():
                matches.append((a_uri, m_uri))
                print(f"MATCH: Site '{a_name}' == '{m_name}'")
                
    if len(arch_data['buildings'])==1 and len(mep_data['buildings'])==1:
        for a_uri, a_name in arch_data['buildings'].items():
            for m_uri, m_name in mep_data['buildings'].items():
                matches.append((a_uri, m_uri))
                print(f"MATCH: Building '{a_name}' == '{m_name}'")
    
    # 2. Match Storeys (The Anchor)
    print("\n--- Aligning Storeys ---")
    for a_uri, a_ele in arch_data['storeys'].items():        
        best_match_uri = None    
        
        for m_uri, m_ele in mep_data['storeys'].items():
            # match with elevation difference consideration
      
            if m_ele == a_ele:  
                best_match_uri = m_uri
        
        if best_match_uri:
            matches.append((a_uri, best_match_uri))
            matched_storeys_count += 1            
            print(f"MATCH: Storey on level '{a_ele}'")

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
    for arch_uri, mep_uri in matches:
        linkset.add((arch_uri, OWL.sameAs, mep_uri))

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
    hvac_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\03LVI"     
    el_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\04SAHKO"    
    arc_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\01ARK\ARK_MET.ttl"

    arc_data = extract_bot_skeleton(arc_ttl)

    # --- HVAC ---
    hvac_skeleton_link_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_lvi_skeleton.ttl"
    link_folder_skeletons(arc_ttl, hvac_ttl_folder, hvac_skeleton_link_ttl)  

    # --- ELECTRICAL ---
    el_skeleton_link_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\linked_sahko_skeleton.ttl"
    link_folder_skeletons(arc_ttl, el_ttl_folder, el_skeleton_link_ttl)    

