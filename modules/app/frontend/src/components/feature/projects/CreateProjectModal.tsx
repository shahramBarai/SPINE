import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Modal } from "components/complex/Modal";
import { Input } from "components/basics/input";
import { Label } from "components/basics/label";
import { Button } from "components/basics/Button";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectItem,
    SelectContent
} from "../../basics/select";
import { Textarea } from "components/basics/textarea";

enum EntityType {
    DISTRICT = "DISTRICT",
    CAMPUS = "CAMPUS",
    BUILDING = "BUILDING",
    LAB = "LAB"
}

interface CreateProjectForm {
    name: string;
    description: string;
    type: EntityType;
}

function CreateProjectModal({
    open,
    setOpen
}: {
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    const utils = api.useUtils();
    const { handleSubmit, register, setValue, reset } =
        useForm<CreateProjectForm>();

    const createProject = api.digitalTwin.createProject.useMutation();

    const onSubmit = async (data: CreateProjectForm) => {
        try {
            await createProject.mutateAsync(data);
            await utils.digitalTwin.getProjects.invalidate();
            toast.success(`${data.name} created.`);
            reset();
            setOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to create project.");
        }
    };

    return (
        <Modal
            title="Create project"
            description="Create a new digital twin project"
            open={open}
            setOpen={setOpen}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex flex-col gap-2">
                    <Label>Name</Label>
                    <Input
                        {...register("name", { required: true })}
                        placeholder="Enter name"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Description</Label>
                    <Textarea
                        {...register("description")}
                        placeholder="Enter description"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Type</Label>
                    <Select
                        onValueChange={(value) =>
                            setValue("type", value as EntityType)
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.values(EntityType).map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={createProject.isPending}
                >
                    {createProject.isPending ? "Creating..." : "Create"}
                </Button>
            </form>
        </Modal>
    );
}

export { CreateProjectModal };
