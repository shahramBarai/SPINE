import {
    AdjustmentsHorizontalIcon,
    TableCellsIcon,
    WindowIcon
} from "@heroicons/react/24/solid";
import { cn } from "utils/index";
import { KafkaLogo } from "components/complex/KafkaLogo";

enum NodeType {
    SOURCE = "source",
    PROCESS = "process",
    SINK = "sink"
}

/** The palette the FlowView sidebar offers, and what each dropped node becomes. */
const nodeItems: {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    type: NodeType;
}[] = [
    {
        label: "Kafka Source",
        Icon: KafkaLogo,
        type: NodeType.SOURCE
    },
    {
        label: "Filter",
        Icon: AdjustmentsHorizontalIcon,
        type: NodeType.PROCESS
    },
    {
        label: "Select",
        Icon: TableCellsIcon,
        type: NodeType.PROCESS
    },
    {
        label: "Window",
        Icon: WindowIcon,
        type: NodeType.PROCESS
    },
    {
        label: "Kafka Sink",
        Icon: KafkaLogo,
        type: NodeType.SINK
    }
];

const ICON_SIZES = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10"
} as const;

const getNodeIcon = (label: string, size: keyof typeof ICON_SIZES = "md") => {
    const Icon = nodeItems.find((node) => node.label === label)?.Icon;
    const sizeClass = ICON_SIZES[size];

    return (
        <div className={cn("flex", sizeClass)}>
            {Icon && <Icon className={sizeClass} />}
        </div>
    );
};

const getNodeType = (label: string) => {
    return nodeItems.find((node) => node.label === label)?.type;
};

export { NodeType, nodeItems, getNodeIcon, getNodeType };
