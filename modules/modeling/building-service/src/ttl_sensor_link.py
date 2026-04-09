#!/usr/bin/env python
# coding: utf-8

# In[9]:


import json
from rdflib import Graph, Literal, Namespace, RDF, RDFS, OWL


# In[11]:


# Define Namespaces
BRICK = Namespace("https://brickschema.org/schema/Brick#")
BOT = Namespace("https://w3id.org/bot#")
INST = Namespace("https://lbd.example.com/")

PREFIXES = {
    "brick": BRICK, "bot": BOT, "inst": INST, "rdfs": RDFS, "owl": OWL
}

# 1. CENTRALIZED TYPE MAPPING
# Add new types here as your project grows
TYPE_MAPPING = {
    "temperature": BRICK.Room_Air_Temperature_Sensor,
    "co2": BRICK.CO2_Sensor,
    "humidity": BRICK.Humidity_Sensor
}


# In[ ]:


def define_sensor_instances(json_files_list):
    """
    Reads multiple JSON files and creates a single graph with all sensors.
    """
    g = Graph()
    for p, ns in PREFIXES.items(): g.bind(p, ns)
    
    for file_path in json_files_list:
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            print(f"Processing {file_path}...")
            
            for sensor in data.get("sensors", []):
                sensor_uuid = sensor.get("uuid")
                if not sensor_uuid: continue
                
                sensor_uri = INST[f"sensor_{sensor_uuid}"]
                vendor_id = sensor.get("vendor_id")
                json_type = sensor.get("type", "").lower()
                
                # Assign Brick class based on mapping, default to generic Sensor
                brick_class = TYPE_MAPPING.get(json_type, BRICK.Sensor)
                g.add((sensor_uri, RDF.type, brick_class))
                
                # Metadata
                if vendor_id:
                    g.add((sensor_uri, RDFS.label, Literal(vendor_id)))
                if sensor.get("vendor"):
                    g.add((sensor_uri, RDFS.comment, Literal(sensor.get("vendor"))))
                    
        except Exception as e:
            print(f"Error processing file {file_path}: {e}")
    
    # Add hasPoint as the inverse of isPointOf
    #g.add((BRICK.hasPoint, OWL.inverseOf, BRICK.isPointOf))
            
    return g


# In[13]:


def link_sensors_to_bot(sensor_graph, external_ttl_path):
    """
    Links sensors to bot:Spaces and returns both the graph and match statistics.
    """
    spatial_graph = Graph()
    stats = {
        "total_sensors": 0,
        "exact_matches": 0,
        "fuzzy_matches": 0,
        "no_matches": 0
    }

    try:
        spatial_graph.parse(external_ttl_path, format="turtle")
    except Exception as e:
        print(f"Error: {e}")
        return sensor_graph, stats

    # SPARQL for prioritized matching
    query = """
        SELECT ?space ?label WHERE {
            ?space rdf:type bot:Space .
            ?space rdfs:label ?label .
            BIND(STR(?label) AS ?sLabel)
            FILTER(
                LCASE(?sLabel) = LCASE(?target) || 
                STRSTARTS(LCASE(?target), LCASE(?sLabel))
            )
        }
    """

    # Get all sensor instances created
    sensors = list(sensor_graph.subjects(RDF.type, None))
    stats["total_sensors"] = len(sensors)

    for sensor_uri in sensors:
        label_lit = sensor_graph.value(sensor_uri, RDFS.label)
        if not label_lit:
            stats["no_matches"] += 1
            continue
            
        target_str = str(label_lit)
        results = spatial_graph.query(query, initBindings={'target': Literal(target_str)})
        
        matches = []
        for row in results:
            space_label = str(row.label)
            # Scoring: 2 = Exact/Case-insensitive, 1 = Prefix
            if target_str.lower() == space_label.lower():
                score = 2
            elif target_str.lower().startswith(space_label.lower()):
                score = 1
            else:
                score = 0
            matches.append((score, row.space))

        if matches:
            # Sort by score descending
            matches.sort(key=lambda x: x[0], reverse=True)
            best_score, best_space = matches[0]
            
            sensor_graph.add((sensor_uri, BRICK.isPointOf, best_space))
            
            if best_score == 2:
                stats["exact_matches"] += 1
            else:
                stats["fuzzy_matches"] += 1
        else:
            stats["no_matches"] += 1
                
    return sensor_graph, stats


# In[14]:


def print_summary_report(stats):
    """Prints a formatted table of the linking results."""
    total_found = stats["exact_matches"] + stats["fuzzy_matches"]
    
    print("\n" + "="*40)
    print("SENSOR LINKING SUMMARY REPORT")
    print("-"*40)
    print(f"{'Metric':<30} | {'Count':<7}")
    print("-"*40)
    print(f"{'Total Sensors Processed':<30} | {stats['total_sensors']}")
    print(f"{'Exact/Case-insensitive Matches':<30} | {stats['exact_matches']}")
    print(f"{'Fuzzy (Prefix) Matches':<30} | {stats['fuzzy_matches']}")
    print(f"{'Total Matches Found':<30} | {total_found}")
    print(f"{'Sensors Without Relations':<30} | {stats['no_matches']}")
    print("="*40 + "\n")


# In[15]:


def save_graph_to_file(graph, output_filename):
    graph.serialize(destination=output_filename, format="turtle")
    print(f"Final graph saved to {output_filename}")


# In[ ]:


# --- Execution ---
if __name__ == "__main__":
    # List all your JSON files here
    json_folder = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\Sensors\metadata"
    json_files = [
        json_folder + "\\sensors-temperature-org10-loc7-2025-12-17T10-16-30-253Z.json", 
        json_folder + "\\sensors-co2-org10-loc7-2025-12-17T10-16-30-253Z.json", 
        json_folder + "\\sensors-humidity-org10-loc7-2025-12-17T10-16-30-253Z.json"
    ]

    # 1. Define instances
    # (Assuming define_sensor_instances remains as previously discussed)
    sensor_graph = define_sensor_instances(json_files)
    
    # 2. Link and get stats
    ark_ttl_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\01ARK\ARK_MET.ttl"
    sensor_graph, match_stats = link_sensors_to_bot(sensor_graph, ark_ttl_path)
    
    # 3. Print the report
    print_summary_report(match_stats)
    
    # 4. Save
    save_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset\sensors_linked.ttl"
    save_graph_to_file(sensor_graph, save_path)

