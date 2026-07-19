import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "utils/trpc";
import {
    ProjectCard,
    ProjectCardLoading,
    CreateProjectModal
} from "components/feature/projects";

const ProjectsPage = () => {
    const [openCreateProjectModal, setOpenCreateProjectModal] = useState(false);

    const projects = api.digitalTwin.getProjects.useQuery();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-foreground mb-6">
                Projects
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2 text-center">
                {projects.isLoading && (
                    <>
                        <ProjectCardLoading />
                        <ProjectCardLoading />
                    </>
                )}
                {projects.data?.map((project) => (
                    <ProjectCard
                        key={project.id}
                        imageUrl={project.coverImageUrl ?? undefined}
                        title={project.name}
                        description={project.description || ""}
                        isPublic={project.isPublic}
                        href={`/projects/${project.id}/manage`}
                    />
                ))}
                <div
                    className="min-h-[300px] border-2 border-border border-dashed rounded-md flex items-center justify-center hover:cursor-pointer hover:bg-muted transition-colors duration-300"
                    onClick={() => setOpenCreateProjectModal(true)}
                >
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Plus className="w-16 h-16" />
                        <p className="text-sm">Add new project</p>
                    </div>
                </div>
            </div>
            {openCreateProjectModal && (
                <CreateProjectModal
                    open={openCreateProjectModal}
                    setOpen={setOpenCreateProjectModal}
                />
            )}
        </div>
    );
};

export { ProjectsPage };
