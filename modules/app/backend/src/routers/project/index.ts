import { router } from "../../trpc";
import { settingsTabRouter } from "./settingsTab";
import { filesRouter } from "./files";
import { graphsRouter } from "./graphs";
import { toolsRouter } from "./tools";
import { semanticSearchRouter } from "./semanticSearch";

// Nested per component group, so procedures are called as
// project.<group>.<name> (e.g. project.files.listFiles). Add a new
// sub-router here when a new component needs backend calls that don't fit
// an existing file.
export const projectRouter = router({
    settingsTab: settingsTabRouter,
    files: filesRouter,
    graphs: graphsRouter,
    tools: toolsRouter,
    semanticSearch: semanticSearchRouter
});
