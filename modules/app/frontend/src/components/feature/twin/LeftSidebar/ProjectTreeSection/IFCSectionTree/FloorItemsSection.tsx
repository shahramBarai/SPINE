import { CheckButton } from "components/basics/CheckBox";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { DatabaseX, Loader } from "lucide-react";
import { cn } from "utils/index";
import { api } from "utils/trpc";

function FloorItemsSection({
    projectId,
    disciplineId,
    fileId,
    fileName,
    isVisible
}: {
    projectId: string;
    disciplineId: string;
    fileId: string;
    fileName: string;
    isVisible: boolean;
}) {
    const { selectedFloorKeys, setSelectedFloorKeys } = useDigitalTwin();

    const {
        data: floorItems = [],
        isLoading,
        isError
    } = api.fileStorage.getProjectIfcFileFloors.useQuery({
        projectId,
        discipline: disciplineId,
        fileId,
        fileName
    });

    const allFloorsSelected =
        floorItems.length > 0 && selectedFloorKeys.length === floorItems.length;

    const handleToggleAllFloors = () => {
        if (selectedFloorKeys.length === floorItems.length) {
            // All floors are currently selected, so deselect all
            setSelectedFloorKeys([]);
        } else {
            setSelectedFloorKeys(floorItems.map((opt) => opt.key));
        }
    };

    const handleToggleFloor = (floorKey: string) => {
        setSelectedFloorKeys((prev) => {
            if (prev.includes(floorKey)) {
                return prev.filter((key) => key !== floorKey);
            } else {
                return [...prev, floorKey];
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center py-1 bg-muted">
                <Loader className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex-1 flex items-center justify-center py-1 bg-muted gap-2">
                <DatabaseX className="h-3.5 w-3.5 text-danger" />
                <div className="text-xs text-danger">
                    Error loading floor items.
                </div>
            </div>
        );
    }

    return (
        <div className="ml-4 mr-1 mb-1 rounded border border-border/40 bg-background/30 p-1">
            <div
                className={cn(
                    "rounded flex items-center gap-2 px-2 py-1 text-[10px]",
                    allFloorsSelected && "bg-primary/10 text-primary"
                )}
            >
                <CheckButton
                    checked={allFloorsSelected}
                    onClick={() => {
                        handleToggleAllFloors();
                    }}
                    disabled={!isVisible}
                />
                <span className="truncate">All floors</span>
            </div>

            <div className="my-1 h-px bg-border/50" />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
                {floorItems.length === 0 ? (
                    <div>No floor items available</div>
                ) : (
                    floorItems.map((option) => {
                        const checked = selectedFloorKeys.includes(option.key);
                        return (
                            <>
                                <div
                                    key={option.key}
                                    className={cn(
                                        "rounded flex items-center gap-2 px-2 py-1 text-[10px]",
                                        checked && "bg-primary/10 text-primary"
                                    )}
                                >
                                    <CheckButton
                                        checked={checked}
                                        onClick={() => {
                                            handleToggleFloor(option.key);
                                        }}
                                        disabled={!isVisible}
                                    />
                                    <span className="truncate">
                                        {option.label}
                                    </span>
                                </div>
                            </>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export { FloorItemsSection };
