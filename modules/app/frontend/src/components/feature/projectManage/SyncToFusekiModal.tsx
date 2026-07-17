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

function SyncToFusekiModal({
    projectId,
    folder,
    fileId,
    fileName,
    open,
    setOpen
}: {
    projectId: string;
    folder: string;
    fileId: string;
    fileName: string;
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    const utils = api.useUtils();
    const [choice, setChoice] = useState<GraphChoice>("existing");
    const [existingGraphUri, setExistingGraphUri] = useState("");
    const [newGraphUri, setNewGraphUri] = useState("");
    const [replace, setReplace] = useState(true);

    const { data: graphs, isLoading } = api.project.listGraphs.useQuery({
        projectId
    });

    const namedGraphs = (graphs ?? []).filter((g) => g.uri !== "default");

    const loadTtl = api.project.loadTtlToFuseki.useMutation();

    const graphUri =
        choice === "existing" ? existingGraphUri : newGraphUri.trim();

    const onSubmit = async () => {
        if (!graphUri) {
            toast.warning("Choose an existing graph or enter a new graph URI.");
            return;
        }

        try {
            await loadTtl.mutateAsync({
                projectId,
                folder,
                fileId,
                fileName,
                graphUri,
                replace
            });
            await utils.project.listGraphs.invalidate({ projectId });
            toast.success(`${fileName} loaded into ${graphUri}.`);
            setOpen(false);
        } catch (error) {
            console.error(error);
            toast.error(`Failed to load ${fileName} into Fuseki.`);
        }
    };

    return (
        <Modal
            title="Load to Fuseki"
            description={`Load ${fileName} into a named graph.`}
            open={open}
            setOpen={setOpen}
        >
            <div className="space-y-4">
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
                        disabled={choice !== "existing" || isLoading}
                        onValueChange={setExistingGraphUri}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue
                                placeholder={
                                    isLoading
                                        ? "Loading graphs..."
                                        : "Select a graph"
                                }
                            />
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
                    {loadTtl.isPending ? "Loading..." : "Load to Fuseki"}
                </Button>
            </div>
        </Modal>
    );
}

export { SyncToFusekiModal };
