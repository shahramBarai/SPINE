interface ProjectTool {
    id: string;
    name: string;
    description: string;
    inputTypes: string[];
    outputTypes: string[];
}

const MOCK_TOOLS: ProjectTool[] = [
    {
        id: "ifc-to-ttl",
        name: "Convert IFC to TTL",
        description:
            "Converts an uploaded IFC model into a Turtle graph following the project's ontology.",
        inputTypes: ["ifc"],
        outputTypes: ["ttl"]
    },
    {
        id: "extract-building-hierarchy",
        name: "Extract Building Hierarchy",
        description:
            "Extracts the site/building/storey/space tree from an IFC or TTL model as a standalone graph.",
        inputTypes: ["ifc", "ttl"],
        outputTypes: ["ttl"]
    },
    {
        id: "validate-ttl-graph",
        name: "Validate TTL Graph",
        description:
            "Checks a TTL file for syntax errors and ontology-shape violations before it's loaded into Fuseki.",
        inputTypes: ["ttl"],
        outputTypes: []
    },
    {
        id: "merge-discipline-graphs",
        name: "Merge Discipline Graphs into Linkset",
        description:
            "Finds matching elements across disciplines (e.g. ARK/RAK) and links them with owl:sameAs into a Linkset graph.",
        inputTypes: ["ttl"],
        outputTypes: ["ttl"]
    }
];

// Stands in for a future `api.project.listTools` tRPC query - same
// data/isLoading/isError shape, so wiring up the real endpoint later (once
// these conversion/extraction tools are actually implemented server-side)
// only touches this file, not ToolsSection.
function useProjectTools(): {
    data: ProjectTool[] | undefined;
    isLoading: boolean;
    isError: boolean;
} {
    return {
        data: MOCK_TOOLS,
        isLoading: false,
        isError: false
    };
}

export { useProjectTools, type ProjectTool };
