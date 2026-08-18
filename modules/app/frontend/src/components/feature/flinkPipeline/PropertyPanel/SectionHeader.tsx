import { CheckIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/16/solid";
import type { StatusType } from "utils/index";
import { AccordionTrigger } from "components/basics/accordion";

interface SectionHeaderProps {
    title: string;
    status: StatusType;
}

/** An accordion trigger that doubles as the section's save-state indicator. */
function SectionHeader({ title, status }: SectionHeaderProps) {
    const getStateIcon = () => {
        switch (status) {
            case "success":
                return <CheckIcon className="size-4 text-success" />;
            case "error":
                return <XMarkIcon className="size-4 text-danger" />;
            case "loading":
                return (
                    <ArrowPathIcon className="size-4 text-muted-foreground animate-spin" />
                );
            case "changed":
                return <ArrowPathIcon className="size-4 text-warning" />;
            default:
                return <span className="size-4" />;
        }
    };

    return (
        <AccordionTrigger className="flex-1 px-4">
            <div className="flex items-center gap-1">
                {getStateIcon()}
                <span className="text-sm font-medium">{title}</span>
                {status === "changed" && (
                    <span className="text-xs bg-warning-light text-warning-light-foreground px-1 py-0.5 rounded">
                        modified
                    </span>
                )}
            </div>
        </AccordionTrigger>
    );
}

export { SectionHeader };
