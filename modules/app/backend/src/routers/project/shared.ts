import { TRPCError } from "@trpc/server";

// Turns a plain Error thrown by ProjectFileService's validation (e.g. a
// disallowed file extension) into a client-facing 400, instead of letting
// it fall through as an opaque 500.
function asBadRequest(error: unknown, fallbackMessage: string): TRPCError {
    return new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : fallbackMessage
    });
}

export { asBadRequest };
