"""
name: graph_manager.py
description: Namespace init, saving, loading of RDF graphs.
"""

from rdflib import Graph, Literal, Namespace, RDF, RDFS, OWL

# Configuration of Namespaces for RDF graph
BRICK = Namespace("https://brickschema.org/schema/Brick#")
BOT = Namespace("https://w3id.org/bot#")
INST = Namespace("https://lbd.example.com/")
PROPS = Namespace("http://lbd.arch.rwth-aachen.de/props#") 
S223 = Namespace("http://data.ashrae.org/standard223#")

PREFIXES = {
    "brick": BRICK, 
    "bot": BOT, 
    "inst": INST, 
    "rdfs": RDFS, 
    "owl": OWL, 
    "props": PROPS, 
    "s223": S223
    }

def init_graph():        
    g = Graph()
    for p, ns in PREFIXES.items(): g.bind(p, ns)
    return g

def save_graph(graph, output_filename):
    graph.serialize(destination=output_filename, format="turtle")
    print(f"Final graph saved to {output_filename}")