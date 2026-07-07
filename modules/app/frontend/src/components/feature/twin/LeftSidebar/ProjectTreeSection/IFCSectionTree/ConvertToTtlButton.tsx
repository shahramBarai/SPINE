import { FileCode2 } from "lucide-react";
import { cn } from "utils/index";

interface ConvertToTtlButtonProps {
    projectId: string;
    disciplineId: string;
    fileId: string;
    fileName: string;
}

function ConvertToTtlButton({
    projectId,
    disciplineId,
    fileId,
    fileName
}: ConvertToTtlButtonProps) {
    const handleConvert = () => {
        // TODO: Wire up with future IFC Provider (TTL Conversion trigger)
        console.log("Convert IFC to TTL for", {
            projectId,
            disciplineId,
            fileId,
            fileName
        });
    };

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                handleConvert();
            }}
            className={cn(
                "h-5 w-5 rounded flex items-center justify-center text-muted-foreground",
                "hover:cursor-pointer hover:text-primary hover:bg-primary/10 transition-all"
            )}
            aria-label={`Convert ${fileName} to TTL`}
            title="Convert to TTL"
        >
            <FileCode2 className="h-3 w-3" />
        </button>
    );
}

export { ConvertToTtlButton };
