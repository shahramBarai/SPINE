import {
  AdjustmentsHorizontalIcon,
  TableCellsIcon,
  WindowIcon,
} from "@heroicons/react/24/solid";
import KafkaLogo from "./KafkaLogo";
import { cn } from "@/client/utils";

export enum NodeType {
  SOURCE = "source",
  PROCESS = "process",
  SINK = "sink",
}

export const nodeItems: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  type: NodeType;
}[] = [
  {
    label: "Kafka Source",
    Icon: KafkaLogo,
    type: NodeType.SOURCE,
  },
  {
    label: "Filter",
    Icon: AdjustmentsHorizontalIcon,
    type: NodeType.PROCESS,
  },
  {
    label: "Select",
    Icon: TableCellsIcon,
    type: NodeType.PROCESS,
  },
  {
    label: "Window",
    Icon: WindowIcon,
    type: NodeType.PROCESS,
  },
  {
    label: "Kafka Sink",
    Icon: KafkaLogo,
    type: NodeType.SINK,
  },
];

export const getNodeIcon = (label: string, size: "sm" | "md" | "lg" = "md") => {
  const Icon = nodeItems.find((node) => node.label === label)?.Icon;
  return (
    <div
      className={cn(
        "flex",
        size === "sm" ? "w-5 h-5" : size === "md" ? "w-7 h-7" : "w-10 h-10"
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            size === "sm" ? "w-5 h-5" : size === "md" ? "w-7 h-7" : "w-10 h-10"
          )}
        />
      )}
    </div>
  );
};

export const getNodeType = (label: string) => {
  return nodeItems.find((node) => node.label === label)?.type;
};
