export const DEFAULT_SPARQL_QUERY = `SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o .
}
LIMIT 200`;

// QueryEditor's own SemanticSearchExample type is id/label only, since it
// leaves resolving an example's text to the caller (see onSelectExample) -
// this panel resolves synchronously against its own fixed list below, so it
// keeps the query text alongside id/label here instead.
type MockSemanticSearchExample = { id: string; label: string; query: string };

// Illustrative starting points covering the query shapes this dataset
// actually supports (see RelationshipGraphService): the plain triple dump,
// cross-discipline owl:sameAs links, and brick:isPointOf sensor-to-space
// links.
export const SEMANTIC_SEARCH_EXAMPLES: MockSemanticSearchExample[] = [
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
