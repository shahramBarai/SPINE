import { api } from "@/utils/trpc";
import { Modal } from "../../complex/Modal";
import { Input } from "../../basics/input";
import { Label } from "../../basics/label";
import { useForm } from "react-hook-form";

import { EntityType } from "@/server/services/data-service/types";
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from "../../basics/select";
import { Button } from "../../basics/Button";

interface CreateEntityForm {
  name: string;
  description: string;
  type: EntityType;
}

function CreateEntityModal({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {

  const { handleSubmit, register, setValue } = useForm<CreateEntityForm>();

  const createEntity = api.entities.createEntity.useMutation();
  const onSubmit = async (data: CreateEntityForm) => {
    await createEntity.mutateAsync(data);
  };

  return (
    <Modal title="Create entity" description="Create a new entity" open={open} setOpen={setOpen}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label>Name</Label>
          <Input {...register("name")} placeholder="Enter name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Description</Label>
          <Input {...register("description")} placeholder="Enter description" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Type</Label>
          <Select onValueChange={(value) => setValue("type", value as EntityType)}>
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
        <Button type="submit" disabled={createEntity.isPending}>
          {createEntity.isPending ? "Creating..." : "Create"}
        </Button>
      </form>
    </Modal>
  );
}

export { CreateEntityModal };