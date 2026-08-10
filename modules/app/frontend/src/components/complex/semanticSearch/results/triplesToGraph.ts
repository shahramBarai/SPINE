import { type GraphData, type GraphEdge, type GraphNode } from "./graph/types";
import { type Triple } from "../types";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const UNKNOWN_TYPE = "Unknown";

// A SPARQL SELECT binding only carries the term's string value by the time
// it reaches us (see SemanticSearchService.executeSemanticSearchQuery), so
// resources have to be told apart from literals by shape: an absolute IRI,
// a urn:, or a blank-node label.
function isResource(term: string): boolean {
    return (
        /^[a-z][a-z0-9+.-]*:\/\//i.test(term) ||
        /^urn:/i.test(term) ||
        term.startsWith("_:")
    );
}

/** Last path segment of an IRI - the readable name for a node or predicate. */
function localName(iri: string): string {
    const separatorIndex = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
    if (separatorIndex < 0) {
        return iri;
    }
    return iri.slice(separatorIndex + 1) || iri;
}

/**
 * Shortens a type IRI into the prefixed form colorForType keys on, e.g.
 * "https://w3id.org/bot#Space" -> "bot:Space".
 */
function typeCurie(iri: string): string {
    const lastSegment = iri.split("/").pop();
    return lastSegment ? lastSegment.replace("#", ":") : iri;
}

/**
 * Derives a node/edge graph from flat subject-predicate-object rows, entirely
 * client-side - the same result set the table view renders, read as a graph.
 *
 * Every subject becomes a node, and so does every object that looks like a
 * resource (which also yields an edge labelled by its predicate).
 * Literal-valued triples aren't edges: rdf:type sets the node's type, rdfs:label
 * its display name, and anything else is kept as a property on the subject node
 * so it stays visible in the selection panel.
 *
 * @param triples The result rows to fold into a graph.
 * @returns The derived nodes and edges.
 */
function triplesToGraph(triples: Triple[]): GraphData {
    const nodesById = new Map<string, GraphNode>();
    const edgesByKey = new Map<string, GraphEdge>();

    const ensureNode = (id: string): GraphNode => {
        const existing = nodesById.get(id);
        if (existing) {
            return existing;
        }

        const node: GraphNode = {
            id,
            label: localName(id),
            type: UNKNOWN_TYPE,
            properties: []
        };
        nodesById.set(id, node);
        return node;
    };

    for (const { subject, predicate, object } of triples) {
        const subjectNode = ensureNode(subject);

        if (predicate === RDF_TYPE) {
            subjectNode.type = typeCurie(object);
            continue;
        }

        if (!isResource(object)) {
            if (predicate === RDFS_LABEL) {
                subjectNode.label = object;
            } else {
                subjectNode.properties.push({
                    predicate: localName(predicate),
                    value: object
                });
            }
            continue;
        }

        ensureNode(object);
        if (subject === object) {
            // A self-loop has no readable rendering on the canvas, and the
            // node itself is already in the graph.
            continue;
        }

        const label = localName(predicate);
        edgesByKey.set(`${subject}|${label}|${object}`, {
            from_id: subject,
            to_id: object,
            label
        });
    }

    return {
        nodes: Array.from(nodesById.values()),
        edges: Array.from(edgesByKey.values())
    };
}

export { triplesToGraph };
