import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Modal } from "components/complex/Modal";
import { Input } from "components/basics/input";
import { Label } from "components/basics/label";
import { Switch } from "components/basics/switch";
import { Button } from "components/basics/Button";

interface CreateProjectForm {
    name: string;
    description: string;
    isPublic: boolean;
}

function CreateProjectModal({
    open,
    setOpen
}: {
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    const utils = api.useUtils();
    const { handleSubmit, register, watch, setValue, reset } =
        useForm<CreateProjectForm>({
            defaultValues: { isPublic: false }
        });

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
                    <Input
                        {...register("description")}
                        placeholder="Enter description"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        checked={watch("isPublic")}
                        onCheckedChange={(checked) =>
                            setValue("isPublic", checked)
                        }
                    />
                    <Label>Public project</Label>
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
