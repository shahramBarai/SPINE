// Hardcoded on purpose - see the Tools section design discussion. Only
// list tools that building-service actually exposes as a runnable
// endpoint - ifc-to-ttl (src/routers/pipeline.py's convert/ifc-to-ttl,
// backed by conversion/ifc_to_lbd.py) is the only one right now.
//
// Other candidates were considered and rejected for now because they
// aren't real callable tools yet:
// - "Extract building hierarchy": services/building_graph.py's get_tree
//   exists and is exposed (GET /api/dataset/{name}/tree), but it's a live
//   query over an already-loaded Fuseki dataset for browsing, not a
//   file-in/file-out conversion - nothing turns it into a standalone TTL.
// - "Validate TTL graph": no implementation anywhere in building-service.
// - "Merge discipline graphs into a linkset": the owl:sameAs linking logic
//   genuinely exists (scripts/ttl_skeleton_link.py, ttl_ifc_system_link.py,
//   ttl_ifc_geom_link.py) but only as standalone scripts with hardcoded
//   local paths - never wired into a FastAPI router or callable service.
//
// Once a second real tool exists, this is the natural point to promote
// into a DB-backed catalog - not before, since we'd just be guessing at
// the table shape.
interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    inputTypes: string[];
    outputTypes: string[];
    available: boolean;
}

const TOOLS: ToolDefinition[] = [
    {
        id: "ifc-to-ttl",
        name: "Convert IFC to TTL",
        description:
            "Converts an uploaded IFC model into a Turtle graph following the project's ontology.",
        inputTypes: ["ifc"],
        outputTypes: ["ttl"],
        available: true
    }
];

export { TOOLS, type ToolDefinition };
