import { Button } from "components/basics/Button";
import { X } from "lucide-react";
import { useState } from "react";

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/** yyyy-mm-dd for an <input type="date">, in local wall-clock terms. */
function formatDateInput(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** HH:mm for an <input type="time">, in local wall-clock terms. */
function formatTimeInput(date: Date): string {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Combines an <input type="date"> + <input type="time"> pair into a Date,
 * treating them as wall-clock time in the BROWSER's own timezone - a
 * simplification (the site's real timezone may differ), same one sunPath.ts
 * already documents for project-north-vs-true-north. Returns null while
 * either field is incomplete (e.g. mid-edit) rather than guessing.
 */
function parseDateTimeInputs(dateStr: string, timeStr: string): Date | null {
    const dateParts = dateStr.split("-").map(Number);
    const timeParts = (timeStr || "00:00").split(":").map(Number);
    const [year, month, day] = dateParts;
    const [hour, minute] = timeParts;
    if (
        year === undefined ||
        month === undefined ||
        day === undefined ||
        hour === undefined ||
        minute === undefined ||
        [year, month, day, hour, minute].some((n) => Number.isNaN(n))
    ) {
        return null;
    }
    return new Date(year, month - 1, day, hour, minute);
}

function SunPanel({
    siteLocation,
    onClose,
    onSubmit
}: {
    siteLocation: { lat: number; lon: number } | null;
    onClose: () => void;
    onSubmit: (latLon: { lat: number; lon: number }, dateTime: Date) => void;
}) {
    const [sunLat, setSunLat] = useState(() =>
        siteLocation ? String(siteLocation.lat) : ""
    );
    const [sunLon, setSunLon] = useState(() =>
        siteLocation ? String(siteLocation.lon) : ""
    );
    const [sunDate, setSunDate] = useState(() => formatDateInput(new Date()));
    const [sunTime, setSunTime] = useState(() => formatTimeInput(new Date()));
    const parsedSunLat = Number(sunLat);
    const parsedSunLon = Number(sunLon);
    const sunInputsValid =
        sunLat.trim() !== "" &&
        sunLon.trim() !== "" &&
        !Number.isNaN(parsedSunLat) &&
        !Number.isNaN(parsedSunLon) &&
        parsedSunLat >= -90 &&
        parsedSunLat <= 90 &&
        parsedSunLon >= -180 &&
        parsedSunLon <= 180;

    const handleSubmit = () => {
        if (!sunInputsValid) {
            return;
        }
        const dateTime = parseDateTimeInputs(sunDate, sunTime) || new Date();
        onSubmit({ lat: parsedSunLat, lon: parsedSunLon }, dateTime);
    };

    return (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-md border border-border/60 bg-surface/95 p-2.5 text-surface-foreground shadow-lg">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    Sun Path
                </span>
                <button
                    onClick={onClose}
                    className="rounded p-0.5 hover:cursor-pointer hover:bg-secondary/60"
                    aria-label="Close"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
            <div className="space-y-1.5">
                <div className="flex flex-row items-center justify-between gap-1">
                    <label className="block">
                        <span className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                            Latitude
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={sunLat}
                            onChange={(e) => setSunLat(e.target.value)}
                            className="mt-0.5 w-full rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-surface-foreground"
                        />
                    </label>
                    <label className="block">
                        <span className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                            Longitude
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={sunLon}
                            onChange={(e) => setSunLon(e.target.value)}
                            className="mt-0.5 w-full rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-surface-foreground"
                        />
                    </label>
                </div>
                <label className="block">
                    <span className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                        Date
                    </span>
                    <input
                        type="date"
                        value={sunDate}
                        onChange={(e) => setSunDate(e.target.value)}
                        className="mt-0.5 w-full rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-surface-foreground"
                    />
                </label>
                <label className="block">
                    <span className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                        Time
                    </span>
                    <input
                        type="time"
                        value={sunTime}
                        onChange={(e) => setSunTime(e.target.value)}
                        className="mt-0.5 w-full rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-surface-foreground"
                    />
                </label>
                <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-[10px] font-mono uppercase tracking-wide"
                    onClick={() => handleSubmit()}
                >
                    Update
                </Button>
                {!sunInputsValid && (
                    <p className="text-[9px] font-mono text-danger">
                        Latitude must be -90..90, longitude -180..180.
                    </p>
                )}
            </div>
        </div>
    );
}

export { SunPanel };
