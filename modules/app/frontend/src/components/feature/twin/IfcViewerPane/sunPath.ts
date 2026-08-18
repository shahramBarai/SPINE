import {
    azimuthAltitudeToEnu,
    dayPath,
    domeGraticule,
    sunPosition,
    type Enu,
    type Graticule,
    type SunSample
} from "@ifc-lite/solar";

export interface SiteLocation {
    /** Degrees, north positive. */
    lat: number;
    /** Degrees, east positive. */
    lon: number;
}

/**
 * Splits a STEP entity's argument list on top-level commas only - commas
 * nested inside a tuple (e.g. RefLatitude's `(deg,min,sec,micro)`) or inside
 * a single-quoted string literal ('' is an escaped quote in STEP) must not
 * split the list early.
 */
function splitStepArgs(argsText: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let inString = false;
    let current = "";

    for (let i = 0; i < argsText.length; i++) {
        const ch = argsText[i];
        if (inString) {
            current += ch;
            if (ch === "'") {
                if (argsText[i + 1] === "'") {
                    current += "'";
                    i++;
                } else {
                    inString = false;
                }
            }
            continue;
        }
        if (ch === "'") {
            inString = true;
            current += ch;
        } else if (ch === "(") {
            depth++;
            current += ch;
        } else if (ch === ")") {
            depth--;
            current += ch;
        } else if (ch === "," && depth === 0) {
            args.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim().length > 0) {
        args.push(current.trim());
    }
    return args;
}

/** Decodes an IfcCompoundPlaneAngleMeasure tuple "(deg,min,sec[,microsec])"
 *  into decimal degrees. Real exporter output gives every component the
 *  same sign as the overall angle (e.g. `(-71,-3,-24,-263305)`, all four
 *  negative, is a single negative angle - not degrees negative and the rest
 *  positive), so the sign is read off `deg` and then every component is
 *  taken by absolute value before summing. */
function parseCompoundAngle(tuple: string): number | null {
    const inner = tuple.trim().replace(/^\(/, "").replace(/\)$/, "");
    const parts = inner.split(",").map((p) => Number(p.trim()));
    if (parts.length < 3 || parts.some((p) => Number.isNaN(p))) {
        return null;
    }
    // `parts.length >= 3` was just checked above, so these three are
    // guaranteed present (only microsec, the optional 4th, needs a default).
    const deg = parts[0]!;
    const min = parts[1]!;
    const sec = parts[2]!;
    const microsec = parts[3] ?? 0;
    const sign = deg < 0 ? -1 : 1;
    return (
        sign *
        (Math.abs(deg) +
            Math.abs(min) / 60 +
            Math.abs(sec) / 3600 +
            Math.abs(microsec) / 3_600_000_000)
    );
}

/**
 * Extracts the site's real-world location from IfcSite's RefLatitude/
 * RefLongitude attributes (present since IFC2x3 - distinct from, and far
 * more commonly populated than, the newer IfcMapConversion mechanism).
 * No ifc-lite package exposes this extraction, so it's a small hand-rolled
 * parse of the one entity line rather than a general STEP parser. Returns
 * null if the file has no IFCSITE, or its lat/long are unset (`$`) or the
 * degenerate `(0,0,0,0)` placeholder some authoring tools emit for "not
 * set" rather than truly omitting the attribute.
 */
export function parseSiteLatLong(content: string): SiteLocation | null {
    const match = content.match(/IFCSITE\s*\(([^;]*)\)\s*;/i);
    if (!match || match[1] === undefined) {
        return null;
    }
    const args = splitStepArgs(match[1]);
    // IFCSITE(GlobalId, OwnerHistory, Name, Description, ObjectType,
    // ObjectPlacement, Representation, LongName, CompositionType,
    // RefLatitude, RefLongitude, RefElevation, LandTitleNumber, SiteAddress)
    const refLatitude = args[9];
    const refLongitude = args[10];
    if (
        !refLatitude ||
        !refLongitude ||
        refLatitude === "$" ||
        refLongitude === "$"
    ) {
        return null;
    }
    const lat = parseCompoundAngle(refLatitude);
    const lon = parseCompoundAngle(refLongitude);
    if (lat === null || lon === null || (lat === 0 && lon === 0)) {
        return null;
    }
    return { lat, lon };
}

// East/North/Up -> this renderer's Y-up world frame. Mirrors the same
// Z-up-to-Y-up swap the geometry pipeline applies everywhere else in this
// app ((x,y,z) -> (x,z,-y), i.e. IFC/project +Y (which points toward true
// north when a site has no explicit rotation) becomes render -Z): east ->
// +X, up -> +Y, north -> -Z. This assumes project north IS true north
// (ignores IfcSite's building-rotation correction, if any) - a reasonable
// simplification for a first pass, not something to treat as survey-grade.
function enuToRender(
    dir: Enu,
    radius: number,
    origin: readonly [number, number, number]
): [number, number, number] {
    return [
        origin[0] + dir.e * radius,
        origin[1] + dir.u * radius,
        origin[2] - dir.n * radius
    ];
}

function pushSegment(
    out: number[],
    a: readonly [number, number, number],
    b: readonly [number, number, number]
): void {
    out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
}

function pushPolyline(
    out: number[],
    points: Enu[],
    radius: number,
    origin: readonly [number, number, number],
    closed: boolean
): void {
    // Loop bounds (`i < points.length - 1`) and the `points.length > 2`
    // guard below guarantee every index used here is in range.
    for (let i = 0; i < points.length - 1; i++) {
        pushSegment(
            out,
            enuToRender(points[i]!, radius, origin),
            enuToRender(points[i + 1]!, radius, origin)
        );
    }
    if (closed && points.length > 2) {
        pushSegment(
            out,
            enuToRender(points[points.length - 1]!, radius, origin),
            enuToRender(points[0]!, radius, origin)
        );
    }
}

/** A short radial tick marking the sun's exact position for one instant -
 *  simpler than a proper tangent-plane ring marker (no cross-product/
 *  normalize basis needed), and reads clearly enough as "the sun is out
 *  here" against the graticule/arc. Drawn regardless of above/below
 *  horizon - the graticule itself is a static reference, so a below-
 *  horizon marker is still meaningful (shows how far below). */
function pushRadialMarker(
    out: number[],
    dir: Enu,
    radius: number,
    origin: readonly [number, number, number]
): void {
    pushSegment(
        out,
        enuToRender(dir, radius * 0.85, origin),
        enuToRender(dir, radius * 1.15, origin)
    );
}

function pushGraticule(
    out: number[],
    graticule: Graticule,
    radius: number,
    origin: readonly [number, number, number]
): void {
    for (const { ring } of graticule.altitudeRings) {
        pushPolyline(out, ring, radius, origin, true);
    }
    for (const { arc } of graticule.azimuthSpokes) {
        pushPolyline(out, arc, radius, origin, false);
    }
}

interface ModelBounds {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
}

const MIN_DOME_RADIUS = 30;

/**
 * Picks a dome radius/origin that comfortably surrounds `bounds` (the
 * renderer's own getModelBounds()) - radius is 1.5x the model's bounding-
 * sphere radius (never smaller than MIN_DOME_RADIUS, for a tiny or
 * geometry-less model), origin is centered over the model in plan and
 * sits at its lowest point (ground level), matching where the decorative
 * floor grid sits. Falls back to a radius-only dome at the world origin
 * when there's no geometry yet to measure.
 */
export function computeDomeGeometry(bounds: ModelBounds | null): {
    radius: number;
    origin: [number, number, number];
} {
    if (!bounds) {
        return { radius: MIN_DOME_RADIUS, origin: [0, 0, 0] };
    }
    const dx = bounds.max.x - bounds.min.x;
    const dy = bounds.max.y - bounds.min.y;
    const dz = bounds.max.z - bounds.min.z;
    const boundingSphereRadius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
    return {
        radius: Math.max(boundingSphereRadius * 1.5, MIN_DOME_RADIUS),
        origin: [
            (bounds.min.x + bounds.max.x) / 2,
            bounds.min.y,
            (bounds.min.z + bounds.max.z) / 2
        ]
    };
}

/**
 * Builds the sun-path dome overlay for `site` as of `date` (defaults to
 * now): the static graticule (altitude rings + azimuth spokes), the arc the
 * sun traces across `date`'s calendar day, and a short radial tick marking
 * exactly where the sun is at `date`'s time-of-day - so the date portion
 * reshapes the arc (day length/height varies by season) while the time
 * portion moves the marker along it. All as a single flat 3D line-list
 * ready for one of the renderer's line-overlay upload methods. `radius`
 * should comfortably clear the model (e.g. derived from its bounding
 * sphere) so the dome visually surrounds the building rather than clipping
 * through it. Cardinal-direction labels aren't included - that needs the
 * renderer's symbolic-text overlay, a separate feature.
 */
export function buildSunPathLines(
    site: SiteLocation,
    radius: number,
    origin: readonly [number, number, number] = [0, 0, 0],
    date: Date = new Date()
): Float32Array {
    const out: number[] = [];
    pushGraticule(out, domeGraticule(), radius, origin);

    const arc: SunSample[] = dayPath(date, site.lat, site.lon, {
        aboveHorizonOnly: true
    });
    pushPolyline(
        out,
        arc.map((sample) => sample.dir),
        radius,
        origin,
        false
    );

    const currentPosition = sunPosition(date, site.lat, site.lon);
    const markerDir = azimuthAltitudeToEnu(
        currentPosition.azimuth,
        currentPosition.altitude
    );
    pushRadialMarker(out, markerDir, radius, origin);

    return Float32Array.from(out);
}
