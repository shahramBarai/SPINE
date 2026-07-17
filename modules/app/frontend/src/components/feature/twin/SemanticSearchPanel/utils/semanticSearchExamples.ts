import { type SemanticSearchExample } from "../types/semanticSearch";

export const DEFAULT_SPARQL_QUERY = `SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o .
}
LIMIT 200`;

// Illustrative starting points covering the query shapes this dataset
// actually supports (see RelationshipGraphService): the plain triple dump,
// cross-discipline owl:sameAs links, and brick:isPointOf sensor-to-space
// links.
export const SEMANTIC_SEARCH_EXAMPLES: SemanticSearchExample[] = [
    {
        id: "all-triples",
        label: "All triples",
        query: DEFAULT_SPARQL_QUERY
    },
    {
        id: "same-as-links",
        label: "owl:sameAs links",
        query: `PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?s ?o
WHERE {
  ?s owl:sameAs ?o .
}
LIMIT 200`
    },
    {
        id: "sensor-points",
        label: "Sensor -> space links",
        query: `PREFIX brick: <https://brickschema.org/schema/Brick#>
SELECT ?sensor ?space
WHERE {
  ?sensor brick:isPointOf ?space .
}
LIMIT 200`
    },
    {
        id: "spaces-by-type",
        label: "Spaces by type",
        query: `PREFIX bot: <https://w3id.org/bot#>
SELECT ?space ?type
WHERE {
  ?space a bot:Space ;
         a ?type .
}
LIMIT 200`
    }
];
