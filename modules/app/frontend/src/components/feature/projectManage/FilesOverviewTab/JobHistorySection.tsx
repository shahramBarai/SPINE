import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, History } from "lucide-react";
import { api } from "utils/trpc";
import { SectionCard } from "components/complex/SectionCard";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";
import { cn } from "utils/index";

// `date` may arrive as an ISO string over the wire even though its static
// type says Date, since plain JSON (no superjson transformer here) can't
// carry Date instances - wrapping in `new Date(...)` normalizes either case.
function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(date));
}

type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
type StatusFilter = "ALL" | JobStatus;

const JOB_HISTORY_PAGE_SIZE = 5;

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
    ALL: "All statuses",
    QUEUED: "Queued",
    RUNNING: "Running",
    COMPLETED: "Completed",
    FAILED: "Failed"
};

function StatusBadge({ status }: { status: JobStatus }) {
    switch (status) {
        case "QUEUED":
        case "RUNNING":
            return (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {status === "RUNNING" ? "Running" : "Queued"}
                </span>
            );
        case "COMPLETED":
            return (
                <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                </span>
            );
        case "FAILED":
            return (
                <span className="flex items-center gap-1 text-xs text-danger">
                    <XCircle className="h-3 w-3" />
                    Failed
                </span>
            );
    }
}

function JobHistorySection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const { data: tools } = api.project.tools.listTools.useQuery();
    const { data: executions, isLoading } =
        api.project.tools.listJobExecutions.useQuery({ projectId });

    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [visibleCount, setVisibleCount] = useState(JOB_HISTORY_PAGE_SIZE);

    const toolName = (jobKey: string) =>
        tools?.find((tool) => tool.id === jobKey)?.name ?? jobKey;

    const filteredExecutions = (executions ?? []).filter(
        (execution) =>
            statusFilter === "ALL" || execution.status === statusFilter
    );
    const visibleExecutions = filteredExecutions.slice(0, visibleCount);
    const remainingCount = filteredExecutions.length - visibleExecutions.length;

    return (
        <SectionCard
            title="Job History"
            className={className}
            action={
                executions &&
                executions.length > 0 && (
                    <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                            setStatusFilter(value as StatusFilter);
                            setVisibleCount(JOB_HISTORY_PAGE_SIZE);
                        }}
                    >
                        <SelectTrigger size="sm" className="w-[130px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(
                                Object.keys(
                                    STATUS_FILTER_LABELS
                                ) as StatusFilter[]
                            ).map((status) => (
                                <SelectItem key={status} value={status}>
                                    {STATUS_FILTER_LABELS[status]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )
            }
        >
            {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading job history...
                </div>
            ) : !executions || executions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                    <History className="h-5 w-5" />
                    No tools have been run yet.
                </div>
            ) : filteredExecutions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                    <History className="h-5 w-5" />
                    No {STATUS_FILTER_LABELS[statusFilter].toLowerCase()} tasks.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                        {visibleExecutions.map((execution) => (
                            <div
                                key={execution.id}
                                className="flex items-center gap-3 px-3 py-2 text-sm"
                            >
                                <div className="flex-1 flex flex-col min-w-0">
                                    <span className="text-foreground truncate">
                                        {toolName(execution.jobKey)}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                        {execution.user.name ??
                                            execution.user.email}{" "}
                                        · {formatDate(execution.createdAt)}
                                    </span>
                                </div>
                                <StatusBadge status={execution.status} />
                            </div>
                        ))}

                        {remainingCount > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    setVisibleCount(
                                        (prev) => prev + JOB_HISTORY_PAGE_SIZE
                                    )
                                }
                                className={cn(
                                    "w-full py-2 text-center text-sm text-muted-foreground transition-colors",
                                    "hover:cursor-pointer hover:text-primary hover:bg-muted"
                                )}
                            >
                                Show{" "}
                                {Math.min(
                                    JOB_HISTORY_PAGE_SIZE,
                                    remainingCount
                                )}{" "}
                                more
                            </button>
                        )}
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                        Showing {visibleExecutions.length} of{" "}
                        {filteredExecutions.length}{" "}
                        {statusFilter === "ALL"
                            ? ""
                            : `${STATUS_FILTER_LABELS[statusFilter].toLowerCase()} `}
                        task
                        {filteredExecutions.length === 1 ? "" : "s"}
                        {statusFilter !== "ALL" &&
                            executions.length !== filteredExecutions.length &&
                            ` (${executions.length} total)`}
                    </p>
                </div>
            )}
        </SectionCard>
    );
}

export { JobHistorySection };
