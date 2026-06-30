import {
    ChevronRight,
    FolderOpen,
    FileCode2,
    Eye,
    EyeOff,
    X
} from "lucide-react";
import { useState, Fragment } from "react";
import { cn } from "utils/index";
import { toast } from "react-toastify";

const getFileKey = (file: File): string =>
    `${file.name}:${file.size}:${file.lastModified}`;

function IfcFileTreeSection({
    discipline,
    ifcVisibilityByFile,
    floorOptionsBySelectionId,
    selectedFloorKeys,
    setSelectedFloorKeys,
    getIfcSelectionId,
    selectedId,
    onSelect,
    onIfcVisibilityChange,
    onIfcFileRemoved
}: {
    discipline: {
        id: string;
        name: string;
    };
    ifcVisibilityByFile: Record<string, boolean>;
    floorOptionsBySelectionId: Map<string, any[]>;
    selectedFloorKeys: string[];
    setSelectedFloorKeys: any;
    getIfcSelectionId: (disciplineId: string, file: File) => string;
    selectedId: string | null;
    onSelect: (selectionId: string) => void;
    onIfcVisibilityChange?: (
        disciplineId: string,
        fileKey: string,
        visible: boolean
    ) => void;
    onIfcFileRemoved?: (disciplineId: string, fileKey: string) => void;
}) {
    const [ifcSectionExpanded, setIfcSectionExpanded] =
        useState<boolean>(false);

    const [floorsExpandedBySelection, setFloorsExpandedBySelection] = useState<
        Record<string, boolean>
    >({});

    const ifcFiles: File[] = []; // FIXME: Replace with actual IFC files for the discipline

    return (
        <>
            <div className="flex items-center rounded text-[11px] py-1 px-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIfcSectionExpanded((prev) => !prev);
                    }}
                    className="h-6 w-6 mr-1 rounded flex items-center justify-center text-muted-foreground hover:bg-accent"
                >
                    <ChevronRight
                        className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            ifcSectionExpanded && "rotate-90"
                        )}
                    />
                </button>
                <div className="flex-1 text-left font-mono tracking-wide">
                    IFC
                    {ifcFiles.length > 0 ? ` (${ifcFiles.length})` : ""}
                </div>
                <button
                    onClick={() => {
                        // FIXME
                        console.log("Open IFC file picker for", discipline.id);
                    }}
                    className="group h-6 px-2 mr-1 rounded flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    aria-label="Load IFC"
                    title="Load"
                >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="pl-1 max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-12 group-hover:opacity-100">
                        Load
                    </span>
                </button>
                <button
                    onClick={() => {
                        // FIXME
                        console.log("Convert IFC to TTL for", discipline.id);
                    }}
                    className="group h-6 px-2 rounded flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    aria-label="Convert to TTL"
                    title="Convert to TTL"
                >
                    <FileCode2 className="h-3.5 w-3.5" />
                    <span className="pl-1 max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-24 group-hover:opacity-100">
                        Convert to TTL
                    </span>
                </button>
            </div>

            {ifcSectionExpanded && ifcFiles.length > 0 && (
                <div className="ml-7 mr-1 mb-1 rounded border border-border/40 bg-background/20">
                    {ifcFiles.map((file, idx) => {
                        const fileKey = getFileKey(file);
                        const fileSelectionId = getIfcSelectionId(
                            discipline.id,
                            file
                        );
                        const isVisible =
                            ifcVisibilityByFile[
                                `${discipline.id}:${fileKey}`
                            ] ?? true;
                        const fileFloorOptions =
                            floorOptionsBySelectionId.get(fileSelectionId) ??
                            [];
                        const floorsExpanded =
                            floorsExpandedBySelection[fileSelectionId] ?? false;
                        const fileFloorKeys = new Set(
                            fileFloorOptions.map((opt) => opt.key)
                        );
                        const selectedFileFloorKeys = selectedFloorKeys.filter(
                            (key) => fileFloorKeys.has(key)
                        );
                        const allFloorsSelected =
                            selectedFileFloorKeys.length === 0;

                        return (
                            <Fragment
                                key={`${discipline.id}-${idx}-${fileKey}`}
                            >
                                <div
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-1 text-[10px] font-mono",
                                        !isVisible && "opacity-50"
                                    )}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect(fileSelectionId);
                                            if (fileFloorOptions.length > 0) {
                                                setFloorsExpandedBySelection(
                                                    (p) => ({
                                                        ...p,
                                                        [fileSelectionId]:
                                                            !floorsExpanded
                                                    })
                                                );
                                            }
                                        }}
                                        className={cn(
                                            "flex-1 truncate text-left inline-flex items-center gap-1",
                                            selectedId === fileSelectionId
                                                ? "text-primary"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {fileFloorOptions.length > 0 && (
                                            <ChevronRight
                                                className={cn(
                                                    "h-3 w-3 shrink-0 transition-transform",
                                                    floorsExpanded &&
                                                        "rotate-90"
                                                )}
                                            />
                                        )}
                                        {file.name}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onIfcVisibilityChange?.(
                                                discipline.id,
                                                fileKey,
                                                !isVisible
                                            );
                                        }}
                                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                                    >
                                        {isVisible ? (
                                            <Eye className="h-3 w-3" />
                                        ) : (
                                            <EyeOff className="h-3 w-3" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onIfcFileRemoved?.(
                                                discipline.id,
                                                fileKey
                                            );
                                            toast(
                                                `IFC File Removed! ${file.name} was removed.`
                                            );
                                        }}
                                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>

                                {floorsExpanded &&
                                    fileFloorOptions.length > 0 && (
                                        <div className="ml-4 mr-1 mb-1 rounded border border-border/40 bg-background/30 p-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFloorKeys(
                                                        (curr: string[]) =>
                                                            curr.filter(
                                                                (key) =>
                                                                    !fileFloorKeys.has(
                                                                        key
                                                                    )
                                                            )
                                                    );
                                                }}
                                                className={cn(
                                                    "w-full rounded px-2 py-1 text-left text-[10px] flex items-center gap-2",
                                                    allFloorsSelected &&
                                                        "bg-primary/10 text-primary"
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    readOnly
                                                    checked={allFloorsSelected}
                                                    className="h-3 w-3"
                                                />
                                                <span>All floors</span>
                                            </button>
                                            <div className="my-1 h-px bg-border/50" />
                                            <div className="max-h-40 overflow-y-auto space-y-0.5">
                                                {fileFloorOptions.map(
                                                    (option) => {
                                                        const checked =
                                                            selectedFloorKeys.includes(
                                                                option.key
                                                            );
                                                        return (
                                                            <button
                                                                key={option.key}
                                                                onClick={(
                                                                    e
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    setSelectedFloorKeys(
                                                                        (
                                                                            curr: string[]
                                                                        ) =>
                                                                            curr.includes(
                                                                                option.key
                                                                            )
                                                                                ? curr.filter(
                                                                                      (
                                                                                          k
                                                                                      ) =>
                                                                                          k !==
                                                                                          option.key
                                                                                  )
                                                                                : [
                                                                                      ...curr,
                                                                                      option.key
                                                                                  ]
                                                                    );
                                                                }}
                                                                className={cn(
                                                                    "w-full rounded px-2 py-1 text-left text-[10px] flex items-center gap-2",
                                                                    checked &&
                                                                        "bg-primary/10 text-primary"
                                                                )}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    readOnly
                                                                    checked={
                                                                        checked
                                                                    }
                                                                    className="h-3 w-3"
                                                                />
                                                                <span className="truncate">
                                                                    {
                                                                        option.label
                                                                    }
                                                                </span>
                                                            </button>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </Fragment>
                        );
                    })}
                </div>
            )}
        </>
    );
}

export { IfcFileTreeSection };
