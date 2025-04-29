import React from "react";
import { CheckIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/16/solid";
import { AccordionTrigger } from "@/client/components/basics/accordion";

type StatusType = "none" | "loading" | "success" | "error" | "changed";

interface SectionHeaderProps {
  title: string;
  status: StatusType;
  hasChanges?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  status,
  hasChanges,
}) => {
  const getStateIcon = () => {
    if (!hasChanges && status !== "none") {
      return <CheckIcon className="size-4 text-green-500" />;
    }

    switch (status) {
      case "success":
        return <CheckIcon className="size-4 text-green-500" />;
      case "error":
        return <XMarkIcon className="size-4 text-red-500" />;
      case "loading":
        return <ArrowPathIcon className="size-4 text-gray-500 animate-spin" />;
      case "changed":
        return <ArrowPathIcon className="size-4 text-amber-500" />;
      default:
        return <span className="size-4" />;
    }
  };

  return (
    <AccordionTrigger className="flex-1 px-4">
      <div className="flex items-center gap-1">
        {getStateIcon()}
        <span className="text-sm font-medium">{title}</span>
        {hasChanges && (
          <span className="text-xs bg-amber-100 text-amber-800 px-1 py-0.5 rounded">
            modified
          </span>
        )}
      </div>
    </AccordionTrigger>
  );
};
