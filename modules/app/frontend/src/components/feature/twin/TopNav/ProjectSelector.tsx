import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { api } from "utils/trpc";
import { ChevronDown, Loader } from "lucide-react";
import { cn } from "utils/index";

function ProjectSelector() {
    const { projectInfo } = useDigitalTwin();
    const navigate = useNavigate();
    const [openProj, setOpenProj] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const {
        data: projectOptions,
        isLoading,
        isError
    } = api.digitalTwin.getProjects.useQuery();

    useEffect(() => {
        if (!openProj) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(event.target as Node)
            ) {
                setOpenProj(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
        };
    }, [openProj]);

    const handleProjectSelect = (project: { id: string; name: string }) => {
        navigate(`/digital-twin/${project.id}`);
        setOpenProj(false);
    };

    if (isLoading) {
        return (
            <div
                className={cn(
                    "flex items-center justify-between h-9 w-64 px-3 text-sm ",
                    "border border-border/60 rounded-md",
                    "bg-background text-foreground",
                    "hover:cursor-default"
                )}
            >
                <span className="font-medium truncate">Loading...</span>
                <Loader className="h-3.5 w-3.5 text-muted-foreground/30 animate-spin" />
            </div>
        );
    }

    if (!projectOptions || isError) {
        return (
            <div
                className={cn(
                    "flex items-center justify-between h-9 w-64 px-3 text-sm ",
                    "border border-border/60 rounded-md",
                    "bg-background text-foreground",
                    "hover:cursor-default"
                )}
            >
                <span className="font-medium truncate">
                    No projects available
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />
            </div>
        );
    }

    return (
        <>
            <div ref={panelRef} className="relative">
                <button
                    onClick={() => setOpenProj(!openProj)}
                    className={cn(
                        "flex items-center justify-between h-9 w-64 px-3 text-sm ",
                        "border border-border/60 rounded-md",
                        "bg-background text-foreground hover:bg-accent hover:text-foreground",
                        "hover:cursor-pointer"
                    )}
                >
                    <span className="font-medium truncate">
                        {projectInfo.name}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {openProj && (
                    <div
                        className={cn(
                            "absolute top-full left-0 mt-1 p-1 w-64 z-10",
                            "border rounded-md border-border/60  ",
                            "bg-accent/90 shadow-lg"
                        )}
                    >
                        {projectOptions.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => {
                                    if (projectInfo.id !== project.id) {
                                        handleProjectSelect(project);
                                    }
                                    setOpenProj(false);
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-2 rounded text-sm transition-colors duration-100",
                                    "hover:cursor-pointer hover:bg-primary/10 hover:scale-102",
                                    projectInfo.id === project.id &&
                                        "text-primary"
                                )}
                            >
                                {project.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

export { ProjectSelector };
