import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Modal } from "components/complex/Modal";
import { Label } from "components/basics/label";
import { Button } from "components/basics/Button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";

interface IfcFileOption {
    folder: string | undefined;
    fileId: string;
    fileName: string;
}

function RunIfcToTtlModal({
    projectId,
    open,
    setOpen,
    onSuccess
}: {
    projectId: string;
    open: boolean;
    setOpen: (open: boolean) => void;
    onSuccess?: () => void;
}) {
    const utils = api.useUtils();
    const { data: folders, isLoading: isLoadingFiles } =
        api.project.files.listFiles.useQuery({ projectId });

    const ifcFiles: IfcFileOption[] = (folders ?? []).flatMap((folder) =>
        folder.files
            .filter((file) => file.fileName.toLowerCase().endsWith(".ifc"))
            .map((file) => ({
                folder: folder.folder,
                fileId: file.fileId,
                fileName: file.fileName
            }))
    );
    const folderNames = (folders ?? [])
        .map((folder) => folder.folder)
        .filter((folder): folder is string => Boolean(folder));

    const [selectedFileKey, setSelectedFileKey] = useState("");
    const [destFolder, setDestFolder] = useState("");
    const [executionId, setExecutionId] = useState<string | null>(null);

    const selectedFile = ifcFiles.find(
        (file) => `${file.folder}/${file.fileId}` === selectedFileKey
    );

    const runTool = api.project.tools.runIfcToTtlTool.useMutation();
    const saveResult = api.project.tools.saveToolResult.useMutation();

    const { data: jobStatus } = api.project.tools.getToolJobStatus.useQuery(
        { projectId, executionId: executionId ?? "" },
        {
            enabled: Boolean(executionId),
            refetchInterval: (query) => {
                const status = query.state.data?.status;
                return status === "COMPLETED" || status === "FAILED"
                    ? false
                    : 2000;
            }
        }
    );

    const reset = () => {
        setSelectedFileKey("");
        setDestFolder("");
        setExecutionId(null);
    };

    const onStart = async () => {
        if (!selectedFile) {
            toast.warning("Select an IFC file to convert.");
            return;
        }

        try {
            const { executionId: newExecutionId } = await runTool.mutateAsync({
                projectId,
                fileId: selectedFile.fileId
            });
            setDestFolder(selectedFile.folder ?? "");
            setExecutionId(newExecutionId);
            utils.project.tools.listJobExecutions.invalidate({ projectId });
        } catch (error) {
            console.error(error);
            toast.error("Failed to start the IFC to TTL conversion.");
        }
    };

    const onSave = async () => {
        if (!executionId || !destFolder.trim()) {
            toast.warning("Choose a destination folder for the result.");
            return;
        }

        try {
            await saveResult.mutateAsync({
                projectId,
                executionId,
                folder: destFolder.trim()
            });
            await utils.project.files.listFiles.invalidate({ projectId });
            utils.project.tools.listJobExecutions.invalidate({ projectId });
            onSuccess?.();
            toast.success("TTL result saved to project storage.");
            setOpen(false);
            reset();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save the conversion result.");
        }
    };

    return (
        <Modal
            title="Convert IFC to TTL"
            description="Runs the building-service pipeline on an uploaded IFC file, then saves the resulting TTL back into project storage."
            open={open}
            setOpen={(next) => {
                setOpen(next);
                if (!next) reset();
            }}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-2">
                    <Label>IFC file</Label>
                    <Select
                        value={selectedFileKey}
                        disabled={Boolean(executionId) || ifcFiles.length === 0}
                        onValueChange={setSelectedFileKey}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue
                                placeholder={
                                    isLoadingFiles
                                        ? "Loading files..."
                                        : ifcFiles.length === 0
                                          ? "No IFC files found"
                                          : "Select an IFC file"
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {ifcFiles.map((file) => (
                                <SelectItem
                                    key={`${file.folder}/${file.fileId}`}
                                    value={`${file.folder}/${file.fileId}`}
                                >
                                    {file.folder ? `${file.folder}/` : ""}
                                    {file.fileName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {!executionId && (
                    <Button
                        variant="primary"
                        disabled={!selectedFile || runTool.isPending}
                        onClick={onStart}
                    >
                        {runTool.isPending ? "Starting..." : "Start conversion"}
                    </Button>
                )}

                {executionId && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            {!jobStatus ||
                            jobStatus.status === "QUEUED" ||
                            jobStatus.status === "RUNNING" ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                        {jobStatus?.status === "RUNNING"
                                            ? "Converting..."
                                            : "Queued..."}
                                    </span>
                                </>
                            ) : jobStatus.status === "COMPLETED" ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                    <span className="text-foreground">
                                        Conversion complete.
                                    </span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-4 w-4 text-danger" />
                                    <span className="text-danger">
                                        {jobStatus.error ??
                                            "Conversion failed."}
                                    </span>
                                </>
                            )}
                        </div>

                        {jobStatus?.status === "COMPLETED" && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <Label>Destination folder</Label>
                                    <Select
                                        value={destFolder}
                                        onValueChange={setDestFolder}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a folder" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {folderNames.map((folder) => (
                                                <SelectItem
                                                    key={folder}
                                                    value={folder}
                                                >
                                                    {folder}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    variant="primary"
                                    disabled={
                                        !destFolder.trim() ||
                                        saveResult.isPending
                                    }
                                    onClick={onSave}
                                >
                                    {saveResult.isPending
                                        ? "Saving..."
                                        : `Save ${jobStatus.resultFileName} to project`}
                                </Button>
                            </>
                        )}

                        {jobStatus?.status === "FAILED" && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    reset();
                                }}
                            >
                                Try again
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export { RunIfcToTtlModal };
