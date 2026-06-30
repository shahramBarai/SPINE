import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "components/basics/input";
import { Button } from "components/basics/Button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "components/basics/form";
import { OAuthButtons } from "./OAuthButtons";
import { Divider } from "components/basics/Divider";
import { api } from "utils/trpc";
import { useNavigate } from "react-router-dom";

const signInSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: z
        .string()
        .min(6, { message: "Password must be at least 6 characters" })
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<SignInValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: "",
            password: ""
        }
    });

    // Use the signIn mutation from tRPC
    const signIn = api.auth.signIn.useMutation({
        onSuccess: () => {
            navigate("/");
        },
        onError: (error) => {
            form.setError("root", {
                message: error.message || "Invalid email or password"
            });
        },
        onSettled: () => {
            setIsLoading(false);
        }
    });

    async function onSubmit(values: SignInValues) {
        setIsLoading(true);
        signIn.mutate(values);
    }

    return (
        <div className="w-full max-w-md space-y-8">
            <div className="flex flex-col items-center justify-center">
                <img
                    src="/metropolia-logo.png"
                    alt="Logo"
                    width={100}
                    height={100}
                />
                <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
                    Sign in to your account
                </h2>
            </div>

            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6 mt-8"
                >
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email address</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Email address"
                                        type="email"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage className="text-red-500 text-xs" />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel>Password</FormLabel>
                                    <a
                                        href="/auth/forgot-password"
                                        className="text-sm font-medium text-primary hover:text-primary/90"
                                    >
                                        Forgot password?
                                    </a>
                                </div>
                                <FormControl>
                                    <Input
                                        placeholder="Password"
                                        type="password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage className="text-red-500 text-xs" />
                            </FormItem>
                        )}
                    />

                    {form.formState.errors.root && (
                        <p className="text-sm font-medium text-red-500">
                            {form.formState.errors.root.message}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing in..." : "Sign in"}
                    </Button>
                </form>
            </Form>

            <Divider text="Or continue with" />

            <OAuthButtons />
        </div>
    );
}
