// Shared type -> color palette for anything in the digital twin that
// renders per-type (relationship graph nodes, semantic search result
// terms, ...), so the same real-world type reads as the same color no
// matter which pane is showing it.
//
// Keys are assumed to be prefixed CURIEs (e.g. "bot:Space", "ifc:Wall") -
// today's backend still returns bare type names (e.g. just "Space"), so
// exact lookups miss until that catches up; the prefix-only fallback below
// covers raw terms (like a semantic-search triple's subject/object) that
// carry a namespace but no distinct "type" at all.
//
// Each domain gets one hue, and each specific type within it steps to a
// different shade of that hue for `fill` - light enough for a fill swatch.
// `stroke` and `text` share one fixed, WCAG-reasonable shade per hue
// instead (darker in light mode, lighter in dark mode via Tailwind's
// `dark:` variant), so an outline/label stays legible regardless of which
// specific type/shade it's next to or which theme is active.
//
// Tailwind's scanner only picks up class names that appear as literal
// strings in source, so these have to be spelled out - no
// `` `fill-${x}-${shade}` `` template composition.

type Color = { fill: string; stroke: string; text: string };

const STROKE_BY_HUE = {
    blue: "stroke-blue-700 dark:stroke-blue-300",
    amber: "stroke-amber-700 dark:stroke-amber-300",
    emerald: "stroke-emerald-700 dark:stroke-emerald-300",
    purple: "stroke-purple-700 dark:stroke-purple-300",
    pink: "stroke-pink-700 dark:stroke-pink-300",
    cyan: "stroke-cyan-700 dark:stroke-cyan-300"
} as const;

const TEXT_BY_HUE = {
    blue: "text-blue-700 dark:text-blue-300",
    amber: "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    purple: "text-purple-700 dark:text-purple-300",
    pink: "text-pink-700 dark:text-pink-300",
    cyan: "text-cyan-700 dark:text-cyan-300"
} as const;

const EXACT_TYPE_COLOR: Record<string, Color> = {
    // BOT: spatial hierarchy
    "bot:site": {
        fill: "fill-blue-100",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },
    "bot:building": {
        fill: "fill-blue-200",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },
    "bot:storey": {
        fill: "fill-blue-300",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },
    "bot:floor": {
        fill: "fill-blue-400",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },
    "bot:space": {
        fill: "fill-blue-500",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },
    "bot:zone": {
        fill: "fill-blue-600",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },
    "bot:room": {
        fill: "fill-blue-700",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },

    // IFC: physical building elements
    "ifc:wall": {
        fill: "fill-amber-100",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    "ifc:door": {
        fill: "fill-amber-200",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    "ifc:window": {
        fill: "fill-amber-300",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    "ifc:roof": {
        fill: "fill-amber-400",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    "ifc:ceiling": {
        fill: "fill-amber-500",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    "ifc:slab": {
        fill: "fill-amber-600",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    "ifc:column": {
        fill: "fill-amber-700",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    "ifc:beam": {
        fill: "fill-amber-800",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },

    // Brick/SAREF: sensors & IoT
    "brick:sensor": {
        fill: "fill-emerald-100",
        stroke: STROKE_BY_HUE.emerald,
        text: TEXT_BY_HUE.emerald
    },
    "brick:actuator": {
        fill: "fill-emerald-200",
        stroke: STROKE_BY_HUE.emerald,
        text: TEXT_BY_HUE.emerald
    },
    "saref:device": {
        fill: "fill-emerald-300",
        stroke: STROKE_BY_HUE.emerald,
        text: TEXT_BY_HUE.emerald
    },
    "saref:meter": {
        fill: "fill-emerald-400",
        stroke: STROKE_BY_HUE.emerald,
        text: TEXT_BY_HUE.emerald
    },

    // Brick: systems & equipment
    "brick:system": {
        fill: "fill-purple-100",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },
    "brick:equipment": {
        fill: "fill-purple-200",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },
    "brick:hvac": {
        fill: "fill-purple-300",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },
    "brick:pump": {
        fill: "fill-purple-400",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },
    "brick:valve": {
        fill: "fill-purple-500",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },
    "brick:fan": {
        fill: "fill-purple-600",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },
    "brick:chiller": {
        fill: "fill-purple-700",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },
    "brick:boiler": {
        fill: "fill-purple-800",
        stroke: STROKE_BY_HUE.purple,
        text: TEXT_BY_HUE.purple
    },

    // Brick: data/telemetry points
    "brick:measurement": {
        fill: "fill-pink-100",
        stroke: STROKE_BY_HUE.pink,
        text: TEXT_BY_HUE.pink
    },
    "brick:property": {
        fill: "fill-pink-200",
        stroke: STROKE_BY_HUE.pink,
        text: TEXT_BY_HUE.pink
    },
    "brick:point": {
        fill: "fill-pink-300",
        stroke: STROKE_BY_HUE.pink,
        text: TEXT_BY_HUE.pink
    },

    // owl:sameAs cross-graph links
    "owl:sameas": {
        fill: "fill-cyan-300",
        stroke: STROKE_BY_HUE.cyan,
        text: TEXT_BY_HUE.cyan
    }
};

// Default color for a namespace when the exact type isn't (yet) listed
// above - what lets a bare CURIE term (no distinct type of its own, e.g. a
// semantic-search triple's subject) still land in a sensible color, using a
// representative mid-gradient shade for that hue.
const PREFIX_COLOR: Record<string, Color> = {
    bot: {
        fill: "fill-blue-400",
        stroke: STROKE_BY_HUE.blue,
        text: TEXT_BY_HUE.blue
    },
    ifc: {
        fill: "fill-amber-400",
        stroke: STROKE_BY_HUE.amber,
        text: TEXT_BY_HUE.amber
    },
    brick: {
        fill: "fill-emerald-300",
        stroke: STROKE_BY_HUE.emerald,
        text: TEXT_BY_HUE.emerald
    },
    saref: {
        fill: "fill-emerald-300",
        stroke: STROKE_BY_HUE.emerald,
        text: TEXT_BY_HUE.emerald
    },
    sensor: {
        fill: "fill-emerald-300",
        stroke: STROKE_BY_HUE.emerald,
        text: TEXT_BY_HUE.emerald
    },
    owl: {
        fill: "fill-cyan-300",
        stroke: STROKE_BY_HUE.cyan,
        text: TEXT_BY_HUE.cyan
    }
};

const UNKNOWN_COLOR: Color = {
    fill: "fill-muted-foreground",
    stroke: "stroke-muted-foreground",
    text: "text-foreground"
};

export function colorForType(type: string): Color {
    const normalized = type.trim().toLowerCase();
    const exact = EXACT_TYPE_COLOR[normalized];
    if (exact) {
        return exact;
    }

    const prefix = normalized.split(":")[0];
    return (prefix && PREFIX_COLOR[prefix]) || UNKNOWN_COLOR;
}
