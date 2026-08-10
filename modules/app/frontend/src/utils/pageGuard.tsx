import type { ComponentType } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface GuardState<T> {
    isLoading?: boolean;
    error?: unknown;
    data?: T;
    loadingLabel?: string;
    /** Use the full viewport for the loading state (e.g. a top-level page) instead of filling its parent. */
    fullScreen?: boolean;
}

interface PageLoadingProps {
    label?: string;
    /** Use the full viewport (e.g. a top-level page) instead of filling its parent. */
    fullScreen?: boolean;
}

/** The loading state a guard shows while it works out what to render. */
function PageLoading({
    label = "Loading...",
    fullScreen = false
}: PageLoadingProps) {
    return (
        <div
            className={
                fullScreen
                    ? "h-screen w-screen flex items-center justify-center gap-2 bg-background text-foreground"
                    : "h-full w-full flex items-center justify-center gap-2 text-foreground"
            }
        >
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">{label}</span>
        </div>
    );
}

interface PageGuardOptions<T, K extends string> {
    /** URL param names this page requires - if any is missing, the page redirects to /404 before `handler` ever runs. */
    params: readonly K[];
    /** Runs now that `params` are known to exist - the client-side analogue of getServerSideProps. */
    handler: (params: Record<K, string>) => GuardState<T>;
}

/**
 * Client-side stand-in for the loading/not-found handling Next.js gives you
 * per page. Wraps a page's content component: the returned component first
 * checks the URL actually has the params the page needs (redirecting to
 * /404 immediately if not), then runs `handler` (a hook - it can call
 * useQuery/etc.) to fetch the page's data, shows a loading state while
 * that's in flight, redirects to /404 on error or missing data, and
 * otherwise renders `Component` with the resolved data as props.
 *
 * This is client-only - Vite here has no SSR layer, so unlike Next.js there
 * is no server-rendered fallback; the loading state always appears in-browser.
 */
function pageGuard<T extends object, K extends string>(
    Component: ComponentType<T>,
    { params: requiredParams, handler }: PageGuardOptions<T, K>
): ComponentType<Record<string, never>> {
    return function GuardedPage() {
        const navigate = useNavigate();
        const routeParams = useParams<Record<string, string>>() as Partial<
            Record<K, string>
        >;

        const missingParam = requiredParams.some((key) => !routeParams[key]);

        if (missingParam) {
            navigate("/404", { replace: true });
            return null;
        }

        const {
            isLoading = false,
            error,
            data,
            loadingLabel = "Loading...",
            fullScreen = false
        } = handler(routeParams as Record<K, string>);

        if (!isLoading && (error || data === undefined)) {
            navigate("/404", { replace: true });
            return null;
        }

        if (isLoading) {
            return <PageLoading label={loadingLabel} fullScreen={fullScreen} />;
        }

        return <Component {...(data as T)} />;
    };
}

export { pageGuard, PageLoading };
