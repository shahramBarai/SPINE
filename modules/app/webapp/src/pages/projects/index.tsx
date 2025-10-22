import AppLayout from "@/client/layout/layout";
import { withAuthSSR } from "@/server/auth/authenticated-ssr";
import {
  EntityCard,
  EntityCardLoading,
  CreateEntityModal,
} from "@/client/components/feature/entities";
import { InferGetServerSidePropsType } from "next";
import { PlusIcon } from "@heroicons/react/24/outline";
import { api } from "@/utils/trpc";
import { useState } from "react";

function Entities(
  props: InferGetServerSidePropsType<typeof getServerSideProps>
) {
  const isAdmin = props.user.role === "ADMIN";
  const [openCreateEntityModal, setOpenCreateEntityModal] = useState(false);

  const entities = api.entities.getEntities.useQuery();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Entities</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2 text-center">
        {entities.isLoading && (
          <>
            <EntityCardLoading />
            <EntityCardLoading />
          </>
        )}
        {entities.data?.map((entity: any) => (
          <EntityCard
            key={entity.id}
            imageUrl={entity.imageUrl}
            title={entity.name}
            description={entity.description}
            type={entity.type}
            href={`/projects/${entity.id}`}
          />
        ))}
        {isAdmin && (
          <div
            className="min-h-[300px] border-2 border-border border-dashed rounded-md flex items-center justify-center hover:cursor-pointer hover:bg-muted transition-colors duration-300"
            onClick={() => {
              setOpenCreateEntityModal(true);
            }}
          >
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <PlusIcon className="w-16 h-16" />
              <p className="text-sm">Add new project</p>
            </div>
          </div>
        )}
      </div>
      {openCreateEntityModal && (
        <CreateEntityModal open={openCreateEntityModal} setOpen={setOpenCreateEntityModal} />
      )}
    </div>
  );
}

Entities.getLayout = function getLayout(page: React.ReactNode) {
  return <AppLayout>{page}</AppLayout>;
};

export default Entities;

export const getServerSideProps = withAuthSSR({
  handler: async ({ req }) => {
    const user = req.session.data.user;
    return {
      props: {
        user: user,
      },
    };
  },
});
