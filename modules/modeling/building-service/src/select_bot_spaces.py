from rdflib import Graph, Namespace, RDF

# Config
input_ttl = "C:/Users/yanpe/OneDrive - Metropolia Ammattikorkeakoulu Oy/Research/MD2MV/data/TTL/01ARK/ARK_MET.ttl"
output_ttl = "C:/Users/yanpe/OneDrive - Metropolia Ammattikorkeakoulu Oy/Research/MD2MV/data/TTL/01ARK/ARK_MET_spaces.ttl"

# 1. Define Namespaces
# BOT is the Building Topology Ontology
BOT = Namespace("https://w3id.org/bot#")
'''OWL = Namespace("http://www.w3.org/2002/07/owl#")
IFC = Namespace("https://standards.buildingsmart.org/IFC/DEV/IFC2x3/TC1/OWL#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")
LBD = Namespace("https://linkedbuildingdata.org/LBD#")
PROPS = Namespace("http://lbd.arch.rwth-aachen.de/props#")
GEO = Namespace("https://www.opengis.net/ont/geosparql#")
INST = Namespace("https://lbd.example.com/")
'''
# 2. Load the source .ttl file
source_graph = Graph()
print("Loading source file...")
source_graph.parse(input_ttl, format="turtle")

# 3. Create a new graph for the output
# We bind the 'bot' prefix so the output looks clean (e.g., uses 'bot:Space' instead of full URL)
output_graph = Graph()
for prefix, namespace in source_graph.namespace_manager.namespaces():
    output_graph.bind(prefix, namespace)

# 4. Define which BOT classes you want to extract
# You can add others like BOT.Building, BOT.Storey, BOT.Element
target_classes = [BOT.Site, BOT.Building, BOT.Space, BOT.Storey]

print(f"Extracting instances of: {[c.split('#')[-1] for c in target_classes]}...")

# 5. Iterate through the source graph
# We look for all subjects (s) that have a type (RDF.type) matching our target classes
for s, p, o in source_graph.triples((None, RDF.type, None)):
    if o in target_classes:
        # We found a match (e.g., s is a bot:Space).
        
        # A. Copy the type declaration itself ( <room1> a bot:Space )
        output_graph.add((s, p, o))
        
        # B. Copy all other properties of this instance
        # This gets the label, area, adjacent elements, etc.
        for s2, p2, o2 in source_graph.triples((s, None, None)):
            output_graph.add((s2, p2, o2))

# 6. Save the new graph to a .ttl file
output_graph.serialize(destination=output_ttl, format="turtle")

print(f"Success! Extracted {len(output_graph)} triples to '{output_ttl}'.")