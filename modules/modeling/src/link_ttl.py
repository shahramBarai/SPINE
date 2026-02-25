import rdflib
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, OWL
from difflib import SequenceMatcher
from pprint import pprint
import ifcopenshell

# --- Namespaces ---
# Adjust IFC namespace to match your specific file version (check file header!)
IFC = Namespace("https://standards.buildingsmart.org/IFC/DEV/IFC2x3/TC1/OWL#") 
BOT = Namespace("https://w3id.org/bot#")

def get_proxy_name(graph, subject):
    """
    Extracts the name from the URI object of owl:sameAs.
    Example: 
      Subject: inst:storey_GUID
      Predicate: owl:sameAs
      Object:  inst:IfcBuildingStorey_181
    Returns: "IfcBuildingStorey_181"
    """
    # 1. Check for owl:sameAs
    for o in graph.objects(subject, OWL.sameAs):
        # Convert URIRef to string (e.g., "http://.../IfcBuildingStorey_181")
        raw_uri = str(o)
        
        # 2. Extract the local name (fragment after last separator)
        if '#' in raw_uri:
            token = raw_uri.split('#')[-1]
        else:
            token = raw_uri.split('/')[-1]
            
        # Return the extracted ID immediately
        if token:
            return token

    # 3. Fallback: If no owl:sameAs, try standard Name property
    for p, o in graph.predicate_objects(subject):
        if "name" in str(p).lower() and isinstance(o, Literal):
            return str(o).strip()
            
    return "Unknown"

def extract_bot_skeleton(ttl_file_path, label):
    print(f"Parsing {label} ({ttl_file_path})...")
    g = Graph()
    g.parse(ttl_file_path, format="ttl")
    
    skeleton = {
        'sites': {}, 'buildings': {}, 'storeys': {}, 'spaces': {}
    }

    # Helper to populate dictionary
    def add_to_skeleton(rdf_type, target_dict):
        for s in g.subjects(RDF.type, rdf_type):
            # USE THE NEW PROXY NAME FUNCTION
            name = get_proxy_name(g, s)
            
            # Avoid overwriting if duplicates exist (though IDs should be unique)
            if name not in target_dict:
                target_dict[name] = s
            else:
                print(f"  [Warning] Duplicate ID found in {label}: {name}")

    # Extract all levels
    add_to_skeleton(BOT.Site, skeleton['sites'])
    add_to_skeleton(BOT.Building, skeleton['buildings'])
    add_to_skeleton(BOT.Storey, skeleton['storeys'])
    #add_to_skeleton(BOT.Space, skeleton['spaces'])

    print(f"  Found: {len(skeleton['sites'])} Sites, {len(skeleton['buildings'])} Bldgs, "
          f"{len(skeleton['storeys'])} Storeys")#, {len(skeleton['spaces'])} Spaces")
    return skeleton

# --- Main Execution ---

# 1. Extract Skeletons
ttl_ark = "C:/Users/yanpe/OneDrive - Metropolia Ammattikorkeakoulu Oy/Research/MD2MV/data/TTL/01ARK/ARK_MET.ttl"
ttl_rak = "C:/Users/yanpe/OneDrive - Metropolia Ammattikorkeakoulu Oy/Research/MD2MV/data/TTL/02RAK/RAK_MET.ttl"
ttl_lvi_iv = "C:/Users/yanpe/OneDrive - Metropolia Ammattikorkeakoulu Oy/Research/MD2MV/data/TTL/03LVI/LVI_IV_MET.ttl"
arch_data = extract_bot_skeleton(ttl_ark, "Architecture")
hvac_iv_data = extract_bot_skeleton(ttl_lvi_iv, "HVAC_IV")
rak_data = extract_bot_skeleton(ttl_rak, "Structure")