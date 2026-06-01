export type SemanticSearchExample = {
  id: string;
  label: string;
  query: string;
};

export const SEMANTIC_SEARCH_EXAMPLES: SemanticSearchExample[] = [
  {
    id: "all-triples",
    label: "All triples (sample)",
    query: `SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o .
}
LIMIT 200`,
  },
  {
    id: "rooms-3rd-floor-building-a",
    label: "Rooms on 3rd floor in Building A",
    query: `PREFIX inst:  <https://lbd.example.com/>  
PREFIX bot:   <https://w3id.org/bot#>
PREFIX brick: <https://brickschema.org/schema/Brick#>
PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?s ?p ?o
WHERE {
  {
    # Triple 1: The room label
    ?s rdfs:label "3.kerros" ;
       rdf:type bot:Storey .
    ?s bot:hasSpace ?o .
    BIND(bot:hasSpace AS ?p)
    
    ?o rdf:type bot:Space ;
       rdfs:label ?roomLabel .
    FILTER (STRSTARTS(?roomLabel, "A"))
  }
  UNION
  {
    # Triple 2: The room label data
    ?storey rdfs:label "3.kerros" ;
            rdf:type bot:Storey .
    ?storey bot:hasSpace ?s .
    ?s rdf:type bot:Space ;
       rdfs:label ?o .
    BIND(rdfs:label AS ?p)
    FILTER (STRSTARTS(?o, "A"))
  }
  UNION
  {
    # Triple 3: Adjacency relationships
    ?storey rdfs:label "3.kerros" ;
            rdf:type bot:Storey .
    ?storey bot:hasSpace ?s .
    ?s rdf:type bot:Space ;
       rdfs:label ?roomLabel .
    FILTER (STRSTARTS(?roomLabel, "A"))
    
    ?s bot:adjacentZone ?o .
    ?storey bot:hasSpace ?o .
    BIND(bot:adjacentZone AS ?p)
  }
}`,
  },
  {
    id: "sensors-examples",
    label: "Sensors examples",
    query: `PREFIX brick: <https://brickschema.org/schema/Brick#>
PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?s ?p ?o
WHERE {
  {
    # Block 1: 100 CO2 Sensors
    SELECT ?s ?p ?o WHERE {
      ?s rdf:type brick:CO2_Sensor .
      BIND(rdf:type AS ?p)
      BIND(brick:CO2_Sensor AS ?o)
    } LIMIT 100
  }
  UNION
  {
    # Block 2: 100 Temperature Sensors
    SELECT ?s ?p ?o WHERE {
      ?s rdf:type brick:Room_Air_Temperature_Sensor .
      BIND(rdf:type AS ?p)
      BIND(brick:Room_Air_Temperature_Sensor AS ?o)
    } LIMIT 100
  }
  UNION
  {
    # Block 3: 100 Humidity Sensors
    SELECT ?s ?p ?o WHERE {
      ?s rdf:type brick:Humidity_Sensor .
      BIND(rdf:type AS ?p)
      BIND(brick:Humidity_Sensor AS ?o)
    } LIMIT 100
  }
}`,
  },
  {
    id: "space-relations",
    label: "Space relationships",
    query: `SELECT ?space ?predicate ?target
WHERE {
  ?space a <https://w3id.org/bot#Space> .
  ?space ?predicate ?target .
}
LIMIT 200`,
  },
];
