import { publicProcedure, router } from "../trpc";

export const digitalTwinRouter = router({
    getProjects: publicProcedure.query(async () => {
        // TODO: Implement logic to fetch projects from the database or any other source
        const projects = [
            { id: "1", name: "Metropolia Myllypuro Campus" },
            { id: "2", name: "SmartLab" }
        ];
        return projects;
    })
});
