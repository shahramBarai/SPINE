import { protectedProcedure, router } from "../trpc";
import { fetchFromDataService } from "../services/data-service";
import { TRPCError } from "@trpc/server";
import z from "zod";

const EntityType = z.enum(["DISTRICT", "CAMPUS", "BUILDING", "LAB", "DEVICE"]);


export const entitiesRouter = router({
  // ------------------------------ CRUD Operations ------------------------------
  // ------------------------------- CREATE ------------------------------
  /**
   * Create a new entity
   * @param name - The name of the entity
   * @param description - The description of the entity
   * @param type - The type of the entity
   * @returns The created entity
   */
  createEntity: protectedProcedure.input(z.object({
    name: z.string(),
    description: z.string(),
    type: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const user = ctx.user;

    // Check if the user is an admin
    if (user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not authorized to create entities",
      });
    }

    // Data to send to the data service
    const data = {
      name: input.name,
      description: input.description,
      type: input.type,
      members: [{
        userId: user.id,
        role: "OWNER",
      }],
    };

    try {
      const response = await fetchFromDataService("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create entity",
        cause: error,
      });
    }
  }),
  // ------------------------------- READ ------------------------------
  getEntities: protectedProcedure.query(async ({ ctx }) => {
    try {
      const response = await fetchFromDataService("/projects");
      return await response.json();
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get entities",
        cause: error,
      });
    }
  }),
  // ------------------------------- UPDATE ------------------------------
  // ------------------------------- DELETE ------------------------------
});