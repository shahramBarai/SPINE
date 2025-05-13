import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { hashPassword, verifyPassword } from "../auth/password";
import { UserSession } from "../auth/iron-session";

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

      // Check if user already exists
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create new user
      const user = await ctx.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
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
    }),

  // Sign in existing user
  signIn: publicProcedure
    .input(signInSchema)
    .mutation(async ({ ctx, input }) => {
      const { email, password } = input;

      // Find user
      const user = await ctx.prisma.user.findUnique({
        where: { email },
      });

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

      // Create session
      const session: UserSession = {
        id: user.id,
        email: user.email,
        fullName: user.name ?? "",
        avatar: "",
      };

      ctx.session.data = { user: session };
      await ctx.session.save();

      return { user: session };
    }),

  // Sign out current user
  signOut: publicProcedure.mutation(async ({ ctx }) => {
    ctx.session.destroy();
    return { success: true };
  }),
});
