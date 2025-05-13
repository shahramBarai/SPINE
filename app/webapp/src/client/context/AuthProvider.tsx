import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { api } from "@/utils/trpc";
import { useRouter } from "next/router";
type User = {
  id: string;
  fullName: string;
  email: string;
  avatar: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const authQuery = api.auth.getSession.useQuery();

  useEffect(() => {
    if (authQuery.data) {
      setUser(authQuery.data);
      setIsLoading(false);
    }
  }, [authQuery.data]);

  const signOutMutation = api.auth.signOut.useMutation({
    onSuccess: () => {
      setUser(null);
      router.push("/auth");
    },
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

export const useAuth = () => useContext(AuthContext);
