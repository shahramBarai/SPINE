import { useState } from "react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Modal } from "components/complex/Modal";
import { Label } from "components/basics/label";
import { Input } from "components/basics/input";
import { Button } from "components/basics/Button";
import { CheckButton } from "components/basics/CheckBox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";

type GraphChoice = "existing" | "new";

interface TtlFileOption {
    folder: string;
    fileId: string;
    fileName: string;
}

function UploadTtlToGraphModal({
    projectId,
    existingGraphs,
    open,
    setOpen,
    onSuccess
}: {
    projectId: string;
    existingGraphs: { uri: string; count: number }[];
    open: boolean;
    setOpen: (open: boolean) => void;
    onSuccess?: () => void;
}) {
    const utils = api.useUtils();
    const { data: folders, isLoading: isLoadingFiles } =
        api.project.listFiles.useQuery({ projectId });

    const ttlFiles: TtlFileOption[] = (folders ?? []).flatMap((folder) =>
        folder.files
            .filter((file) => file.fileName.toLowerCase().endsWith(".ttl"))
            .map((file) => ({
                folder: folder.folder,
                fileId: file.fileId,
                fileName: file.fileName
            }))
    );

    const [selectedFileKey, setSelectedFileKey] = useState("");
    const [choice, setChoice] = useState<GraphChoice>("existing");
    const [existingGraphUri, setExistingGraphUri] = useState("");
    const [newGraphUri, setNewGraphUri] = useState("");
    const [replace, setReplace] = useState(true);

    const namedGraphs = existingGraphs.filter((g) => g.uri !== "default");
    const selectedFile = ttlFiles.find(
        (file) => `${file.folder}/${file.fileId}` === selectedFileKey
    );
    const graphUri =
        choice === "existing" ? existingGraphUri : newGraphUri.trim();

    const loadTtl = api.project.loadTtlToFuseki.useMutation();

    const onSubmit = async () => {
        if (!selectedFile) {
            toast.warning("Select a TTL file to load.");
            return;
        }
        if (!graphUri) {
            toast.warning(
                "Choose an existing graph or enter a new graph URI."
            );
            return;
        }

        try {
            await loadTtl.mutateAsync({
                projectId,
                folder: selectedFile.folder,
                fileId: selectedFile.fileId,
                fileName: selectedFile.fileName,
                graphUri,
                replace
            });
            await utils.project.listGraphs.invalidate({ projectId });
            onSuccess?.();
            toast.success(`${selectedFile.fileName} loaded into ${graphUri}.`);
            setOpen(false);
        } catch (error) {
            console.error(error);
            toast.error(
                `Failed to load ${selectedFile.fileName} into Fuseki.`
            );
        }
    };

    return (
        <Modal
            title="Upload TTL to Fuseki"
            description="Load a TTL file from project storage into a named graph."
            open={open}
            setOpen={setOpen}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-2">
                    <Label>TTL file</Label>
                    <Select
                        value={selectedFileKey}
                        onValueChange={setSelectedFileKey}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue
                                placeholder={
                                    isLoadingFiles
                                        ? "Loading files..."
                                        : ttlFiles.length === 0
                                          ? "No TTL files found"
                                          : "Select a TTL file"
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {ttlFiles.map((file) => (
                                <SelectItem
                                    key={`${file.folder}/${file.fileId}`}
                                    value={`${file.folder}/${file.fileId}`}
                                >
                                    {file.folder}/{file.fileName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="radio"
                            id="graph-existing"
                            name="graph-choice"
                            checked={choice === "existing"}
                            onChange={() => setChoice("existing")}
                        />
                        <Label htmlFor="graph-existing">
                            Use an existing graph
                        </Label>
                    </div>
                    <Select
                        value={existingGraphUri}
                        disabled={choice !== "existing"}
                        onValueChange={setExistingGraphUri}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a graph" />
                        </SelectTrigger>
                        <SelectContent>
                            {namedGraphs.map((g) => (
                                <SelectItem key={g.uri} value={g.uri}>
                                    {g.uri} ({g.count} triples)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="radio"
                            id="graph-new"
                            name="graph-choice"
                            checked={choice === "new"}
                            onChange={() => setChoice("new")}
                        />
                        <Label htmlFor="graph-new">Create a new graph</Label>
                    </div>
                    <Input
                        placeholder="e.g. urn:spine:my-project:model-1"
                        disabled={choice !== "new"}
                        value={newGraphUri}
                        onChange={(e) => setNewGraphUri(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <CheckButton
                        checked={replace}
                        onClick={() => setReplace((v) => !v)}
                    />
                    <Label>Replace existing graph content</Label>
                </div>

                <Button
                    variant="primary"
                    disabled={loadTtl.isPending}
                    onClick={onSubmit}
                >
                    {loadTtl.isPending ? "Loading..." : "Upload to Fuseki"}
                </Button>
            </div>
        </Modal>
    );
}

export { UploadTtlToGraphModal };
