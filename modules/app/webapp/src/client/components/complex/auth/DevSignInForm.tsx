import { useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/client/components/basics/Button";
import { api } from "@/utils/trpc";
import Image from "next/image";
import { SignInForm } from "./SignInForm";

interface DevUser {
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  description: string;
}

const devUsers: DevUser[] = [
  {
    email: "admin@iot-platform.dev",
    name: "Admin User",
    role: "ADMIN",
    description: "Full access to all platform features",
  },
  {
    email: "user@iot-platform.dev",
    name: "Regular User",
    role: "USER",
    description: "Standard user with limited permissions",
  },
  {
    email: "john.doe@iot-platform.dev",
    name: "John Doe",
    role: "USER",
    description: "Sample user for testing",
  },
  {
    email: "jane.admin@iot-platform.dev",
    name: "Jane Admin",
    role: "ADMIN",
    description: "Another admin for testing",
  },
];

export function DevSignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isNormalSignIn, setIsNormalSignIn] = useState(false);

  const devSignIn = api.auth.devSignIn.useMutation({
    onSuccess: () => {
      router.push("/");
    },
    onError: (error) => {
      console.error("Dev sign-in error:", error);
      alert(`Error: ${error.message}`);
    },
    onSettled: () => {
      setIsLoading(null);
    },
  });

  const handleDevSignIn = (user: DevUser) => {
    setIsLoading(user.email);
    devSignIn.mutate(user);
  };

  return (
    <div className="w-full max-w-2xl space-y-8 flex flex-col items-center justify-center">
      {isNormalSignIn ? (
        <SignInForm />
      ) : (
        <>
          <div className="flex flex-col items-center justify-center">
            <Image
              src="/metropolia-logo.png"
              alt="Logo"
              width={100}
              height={100}
            />
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
              Development Mode Sign In
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select a user to sign in instantly (dev mode only)
            </p>
          </div>
          <div className="mt-8 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Development Mode:</strong> These accounts are
                auto-created with default password &quot;dev123456&quot;. This
                feature is only available in development environment.
              </p>
            </div>

            <div className="grid gap-4">
              {devUsers.map((user) => (
                <div
                  key={user.email}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{user.name}</h3>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            user.role === "ADMIN"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {user.email}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {user.description}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleDevSignIn(user)}
                      disabled={isLoading !== null}
                      variant={"outline"}
                    >
                      {isLoading === user.email ? "Signing in..." : "Sign In"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="w-full max-w-2xl mt-6 pt-6 border-t">
        <p className="text-sm text-muted-foreground text-center">
          {isNormalSignIn ? (
            <>
              Need to sign in with a dev account?{"  "}
              <button
                onClick={() => setIsNormalSignIn(false)}
                className="text-primary hover:underline"
              >
                Use dev sign in
              </button>
            </>
          ) : (
            <>
              Need to sign in with a real account?{"  "}
              <button
                onClick={() => setIsNormalSignIn(true)}
                className="text-primary hover:underline"
              >
                Use normal sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
