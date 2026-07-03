import { useState } from "react";
import {
    Building2,
    Radio,
    Eye,
    PanelLeftClose,
    PanelLeftOpen
} from "lucide-react";
import { cn } from "utils/index";

import { ProjectTreeSection } from "./ProjectTreeSection";
// import { LiveSensorsSection } from "./LiveSensorsSection";
// import { ViewLayersSection } from "./ViewLayersSection";
// import { SelectedElementPanel } from "./SelectedElementPanel";
// import { type ViewerComponentInfo, type ViewerFloorOption } from "./ViewerPane";

const SectionHeader = ({
    icon: Icon,
    label,
    count,
    collapsed
}: {
    icon: typeof Radio;
    label: string;
    count?: number;
    collapsed?: boolean;
}) => (
    <div className="flex items-center gap-2 px-3 pt-4 pb-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span
            className={cn(
                "text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground",
                collapsed && "hidden"
            )}
        >
            {label}
        </span>
        {typeof count === "number" && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
                {count}
            </span>
        )}
    </div>
);

export const LeftSidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                isCollapsed ? "w-10" : "w-72",
                "border-r border-border/60 bg-sidebar/80 backdrop-blur-md flex flex-col overflow-hidden"
            )}
        >
            <div className="flex items-center justify-between px-3 h-10 border-b border-border/60">
                <span
                    className={cn(
                        "text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground",
                        isCollapsed && "hidden"
                    )}
                >
                    Project Explorer
                </span>
                <button
                    onClick={() => setIsCollapsed((prev) => !prev)}
                    className="h-7 w-7 rounded hover:bg-accent flex items-center justify-center text-muted-foreground"
                >
                    {isCollapsed ? (
                        <PanelLeftOpen className="h-3.5 w-3.5" />
                    ) : (
                        <PanelLeftClose className="h-3.5 w-3.5" />
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <SectionHeader
                    icon={Building2}
                    label="Project Tree"
                    collapsed={isCollapsed}
                />
                <ProjectTreeSection className="px-1.5" />

                <SectionHeader
                    icon={Radio}
                    label="Live Sensors"
                    collapsed={isCollapsed}
                />
                {/* <LiveSensorsSection sensorsData={sensorsData} sensorIcons={sensorIcon} selectedId={selectedId} onSelect={onSelect} /> */}

                <SectionHeader
                    icon={Eye}
                    label="View Layers"
                    collapsed={isCollapsed}
                />
                {/* <ViewLayersSection layers={layers} onToggleLayer={onToggleLayer} /> */}
            </div>

            {/* {selectedComponentInfo && <SelectedElementPanel info={selectedComponentInfo} />} */}
        </aside>
    );
};
