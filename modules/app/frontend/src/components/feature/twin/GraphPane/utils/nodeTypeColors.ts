// Node "type" values come from whatever ontology the backend's SPARQL query
// resolved (BOT for spatial hierarchy, Brick/IFC for physical elements,
// SAREF for sensors/devices, ...), so we can't know every type up front.
// Known types are grouped by domain, and each group gets one solid color
// from the theme's shared categorical palette (--chart-1..5, defined for
// both light and dark mode in globals.css) - all types in a group share that
// color, since the label above each node already gives the exact type.
// Anything not listed here (a truly unknown type) falls back to grey.
//
// Tailwind's scanner only picks up class names that appear as literal
// strings in source, so these have to be spelled out - no `` `fill-${x}` ``
// template composition.

const GROUP_COLORS = {
    // BOT: spatial hierarchy
    spatial: { fill: "fill-chart-1", stroke: "stroke-chart-1" },
    // Brick/IFC: physical building elements
    element: { fill: "fill-chart-2", stroke: "stroke-chart-2" },
    // SAREF: sensors & IoT
    sensor: { fill: "fill-chart-3", stroke: "stroke-chart-3" },
    // Systems & equipment
    system: { fill: "fill-chart-4", stroke: "stroke-chart-4" },
    // Data/telemetry
    telemetry: { fill: "fill-chart-5", stroke: "stroke-chart-5" }
} as const;

const NODE_TYPE_GROUP: Record<string, keyof typeof GROUP_COLORS> = {
    // BOT: spatial hierarchy
    site: "spatial",
    building: "spatial",
    storey: "spatial",
    floor: "spatial",
    space: "spatial",
    zone: "spatial",
    room: "spatial",

    // Brick/IFC: physical building elements
    wall: "element",
    door: "element",
    window: "element",
    roof: "element",
    ceiling: "element",
    slab: "element",
    column: "element",
    beam: "element",

    // SAREF: sensors & IoT
    sensor: "sensor",
    actuator: "sensor",
    device: "sensor",
    meter: "sensor",

    // Systems & equipment
    system: "system",
    equipment: "system",
    hvac: "system",
    pump: "system",
    valve: "system",
    fan: "system",
    chiller: "system",
    boiler: "system",

    // Data/telemetry
    measurement: "telemetry",
    property: "telemetry",
    point: "telemetry"
};

const UNKNOWN_TYPE_COLOR = {
    fill: "fill-muted-foreground",
    stroke: "stroke-muted-foreground"
};

export function colorForNodeType(type: string): {
    fill: string;
    stroke: string;
} {
    const group = NODE_TYPE_GROUP[type.trim().toLowerCase()];
    return group ? GROUP_COLORS[group] : UNKNOWN_TYPE_COLOR;
}
