import type { ComponentType } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import { PageLoading } from "utils/pageGuard";

/**
 * Client-side stand-in for the role check the Next.js admin pages ran in
 * `getServerSideProps` (via `withAuthSSR`): wraps a page so it only renders
 * for an ADMIN and sends everyone else to /dashboard, the same destination
 * the server-side redirect used.
 *
 * Signed-out visitors are already bounced to /auth by AuthProvider, so this
 * only has to cover the signed-in-but-not-an-admin case. Being client-only,
 * the page's code still reaches the browser - this hides the UI, it doesn't
 * protect data; anything sensitive stays gated in the backend procedure.
 */
function adminGuard<T extends object>(
    Component: ComponentType<T>
): ComponentType<T> {
    return function AdminGuardedPage(props: T) {
        const { user, isLoading } = useAuth();

        if (isLoading) {
            return <PageLoading label="Checking permissions..." />;
        }

        // AuthProvider is already navigating to /auth - render nothing
        // rather than flashing a redirect of our own on the way out.
        if (!user) {
            return null;
        }

        if (user.role !== "ADMIN") {
            return <Navigate to="/dashboard" replace />;
        }

        return <Component {...props} />;
    };
}

export { adminGuard };
