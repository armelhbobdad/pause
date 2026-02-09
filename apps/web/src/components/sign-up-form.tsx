"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import z from "zod";

import { NativeButton } from "@/components/uitripled/native-button-shadcnui";
import { NativeInput } from "@/components/uitripled/native-input-shadcnui";
import { authClient } from "@/lib/auth-client";

import Loader from "./loader";
import { Label } from "./ui/label";

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: () => void;
}) {
  const router = useRouter();
  const { isPending } = authClient.useSession();
  const [serverError, setServerError] = useState("");

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      setServerError("");
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            router.push("/dashboard");
          },
          onError: (error) => {
            setServerError(
              error.error.message || error.error.statusText || "Sign up failed"
            );
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div
      className="glass-panel mx-auto mt-0 w-full max-w-[480px] rounded-2xl border p-6"
      data-glass
      style={{
        background: "var(--pause-glass)",
        backdropFilter: "blur(var(--pause-blur-medium))",
        WebkitBackdropFilter: "blur(var(--pause-blur-medium))",
        borderColor: "oklch(1 0 0 / 0.15)",
        boxShadow: "0 8px 32px oklch(0 0 0 / 0.3)",
      }}
    >
      <h1 className="mb-6 text-center font-bold text-3xl">Create Account</h1>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div>
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Name</Label>
                <NativeInput
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p
                    className="text-sm"
                    key={error?.message}
                    style={{ color: "hsl(var(--destructive))" }}
                  >
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Email</Label>
                <NativeInput
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="email"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p
                    className="text-sm"
                    key={error?.message}
                    style={{ color: "hsl(var(--destructive))" }}
                  >
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Password</Label>
                <NativeInput
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p
                    className="text-sm"
                    key={error?.message}
                    style={{ color: "hsl(var(--destructive))" }}
                  >
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        {serverError && (
          <p className="text-sm" style={{ color: "hsl(var(--destructive))" }}>
            {serverError}
          </p>
        )}

        <form.Subscribe>
          {(state) => (
            <NativeButton
              className="w-full"
              disabled={!state.canSubmit}
              loading={state.isSubmitting}
              type="submit"
            >
              Sign Up
            </NativeButton>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <button
          className="text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
          onClick={onSwitchToSignIn}
          type="button"
        >
          Already have an account? Sign In
        </button>
      </div>
    </div>
  );
}
