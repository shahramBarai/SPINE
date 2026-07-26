import { type Triple } from "components/complex/semanticSearch/ResultsTable";

const MOCK_TRIPLES: Triple[] = [
    { subject: "ifc:Wall_3f2a91", predicate: "rdf:type", object: "ifc:Wall" },
    {
        subject: "ifc:Wall_3f2a91",
        predicate: "bot:containedInSpace",
        object: "bot:Space_204"
    },
    { subject: "bot:Space_204", predicate: "rdf:type", object: "bot:Space" },
    {
        subject: "bot:Space_204",
        predicate: "owl:sameAs",
        object: "bot:Space_204_rak"
    },
    {
        subject: "bot:Space_204_rak",
        predicate: "rdf:type",
        object: "bot:Space"
    },
    {
        subject: "sensor:Temp_12",
        predicate: "rdf:type",
        object: "brick:Temperature_Sensor"
    },
    {
        subject: "sensor:Temp_12",
        predicate: "brick:isPointOf",
        object: "bot:Space_204"
    },
    {
        subject: "ifc:Door_9c14",
        predicate: "bot:containedInSpace",
        object: "bot:Space_204"
    }
];

// Stands in for a future `api.digitalTwin.runSemanticSearch` tRPC query -
// same data/isLoading/isError shape, so wiring up the real endpoint later
// only touches this file, not QueryEditor/ResultsTable/index.
function useSemanticSearch({
    query,
    enabled
}: {
    query: string | null;
    enabled: boolean;
}): { data: Triple[] | undefined; isLoading: boolean; isError: boolean } {
    void query;

    return {
        data: enabled ? MOCK_TRIPLES : undefined,
        isLoading: false,
        isError: false
    };
}

export { useSemanticSearch };
