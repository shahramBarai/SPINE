import { createContext, useContext, type ReactNode, useEffect } from "react";
import { api } from "utils/trpc";
import { useLocation, useNavigate } from "react-router-dom";

type User = {
    id: string;
    fullName: string;
    email: string;
    avatar: string;
    role: "ADMIN" | "USER";
};

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    signOut: () => {}
});

function AuthProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const utils = api.useUtils();

    const {
        data: user = null,
        isLoading,
        isError
    } = api.auth.getSession.useQuery(undefined, {
        retry: false,
        staleTime: 1000 * 60 * 2, // Consider the session "fresh" for 2 minutes
        refetchOnWindowFocus: false // Don't refetch every time the user clicks back onto the browser tab
    });

    useEffect(() => {
        // If loading is done, and there is no user, or hard network error, redirect to /auth
        if (!isLoading && (!user || isError)) {
            if (location.pathname !== "/auth") {
                navigate("/auth");
            }
        } else if (!isLoading && user) {
            if (location.pathname === "/auth") {
                navigate("/");
            }
        }
    }, [isLoading, user, isError, navigate]);

    const signOutMutation = api.auth.signOut.useMutation({
        onSuccess: () => {
            utils.auth.getSession.invalidate(); // Invalidate the session query to refetch the user data
        }
    });

    const signOut = () => {
        signOutMutation.mutate();
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}

export { AuthProvider, useAuth };
