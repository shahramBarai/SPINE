import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { hashPassword, verifyPassword } from "../auth/password";
import { UserSession } from "../auth/iron-session";
import { dataServiceApi } from "../api/data-service";

// User input validation schemas
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const devSignInSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["ADMIN", "USER"]),
});

export const authRouter = router({
  // Get the current user session
  getSession: protectedProcedure.query(async ({ ctx }) => {
    return ctx.session.data.user;
  }),

  // Sign up a new user
  signUp: publicProcedure
    .input(signUpSchema)
    .mutation(async ({ ctx, input }) => {
      const { email, password, name } = input;

      try {
        // Check if user already exists
        const existingUser = await dataServiceApi.getUserByEmail(email);

        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User already exists",
          });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create new user
        const user = await dataServiceApi.createUser({
          email,
          password: hashedPassword,
          name,
        });

        // Create session
        const session: UserSession = {
          id: user.id,
          email: user.email,
          fullName: user.name ?? "",
          avatar: "",
        };

        ctx.session.data.user = session;
        await ctx.session.save();

        return { user: session };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }
    }),

  // Sign in existing user
  signIn: publicProcedure
    .input(signInSchema)
    .mutation(async ({ ctx, input }) => {
      const { email, password } = input;

      try {
        // Find user with password
        const user = await dataServiceApi.getUserWithPassword(email);

        if (!user || !user.password) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invalid email or password",
          });
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);

        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Get full user details
        const fullUser = await dataServiceApi.getUserByEmail(email);

        if (!fullUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Create session
        const session: UserSession = {
          id: user.id,
          email: user.email,
          fullName: fullUser.name ?? "",
          avatar: "",
        };

        ctx.session.data = { user: session };
        await ctx.session.save();

        return { user: session };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sign in",
        });
      }
    }),

  // Sign out current user
  signOut: publicProcedure.mutation(async ({ ctx }) => {
    ctx.session.destroy();
    return { success: true };
  }),

  // Dev mode sign in - creates user if not exists
  devSignIn: publicProcedure
    .input(devSignInSchema)
    .mutation(async ({ ctx, input }) => {
      // Only allow in development mode
      if (process.env.NODE_ENV !== "development") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Dev sign-in only available in development mode",
        });
      }

      const { email, name, role } = input;

      try {
        // Check if user exists
        let user = await dataServiceApi.getUserByEmail(email);

        if (!user) {
          // Create user with a default dev password
          const devPassword = await hashPassword("dev123456");
          user = await dataServiceApi.createUser({
            email,
            password: devPassword,
            name,
            role,
          });
        }

        // Create session
        const session: UserSession = {
          id: user.id,
          email: user.email,
          fullName: user.name || name,
          avatar: "",
        };

        ctx.session.data = { user: session };
        await ctx.session.save();

        return { user: session };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sign in",
        });
      }
    }),
});
