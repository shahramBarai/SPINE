import { type SemanticSearchExample } from "components/complex/semanticSearch/QueryEditor";

export const DEFAULT_SPARQL_QUERY = `SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o .
}
LIMIT 200`;

// A simple starter set for now - once saved SPARQL queries are persisted
// (see SavedQueriesBar), this is the natural place to read the project's
// own saved queries instead of/alongside this fixed list.
export const SEMANTIC_SEARCH_EXAMPLES: SemanticSearchExample[] = [
    {
        id: "all-triples",
        label: "All triples",
        query: DEFAULT_SPARQL_QUERY
    },
    {
        id: "same-as-links",
        label: "owl:sameAs links",
        // ?p is BIND-ed rather than selected as a pattern variable since
        // the predicate here is fixed (owl:sameAs) - the semantic search
        // backend only extracts a displayable triple from bindings that
        // name all three of s/p/o (or subject/predicate/object).
        query: `PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?s ?p ?o
WHERE {
  ?s owl:sameAs ?o .
  BIND(owl:sameAs AS ?p)
}
LIMIT 200`
    },
    {
        id: "sensor-points",
        label: "Sensor -> space links",
        query: `PREFIX brick: <https://brickschema.org/schema/Brick#>
SELECT ?s ?p ?o
WHERE {
  ?s brick:isPointOf ?o .
  BIND(brick:isPointOf AS ?p)
}
LIMIT 200`
    },
    {
        id: "spaces-by-type",
        label: "Spaces by type",
        query: `PREFIX bot: <https://w3id.org/bot#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT ?s ?p ?o
WHERE {
  ?s a bot:Space ;
     a ?o .
  BIND(rdf:type AS ?p)
}
LIMIT 200`
    }
];
