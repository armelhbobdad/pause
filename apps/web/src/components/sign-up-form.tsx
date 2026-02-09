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
    <div>
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
              <div className="space-y-1.5">
                <Label
                  className="text-[13px]"
                  htmlFor={field.name}
                  style={{ color: "oklch(0.7 0.02 250)" }}
                >
                  Name
                </Label>
                <NativeInput
                  className="rounded-xl"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Your name"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p
                    className="text-[12px]"
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
              <div className="space-y-1.5">
                <Label
                  className="text-[13px]"
                  htmlFor={field.name}
                  style={{ color: "oklch(0.7 0.02 250)" }}
                >
                  Email address
                </Label>
                <NativeInput
                  className="rounded-xl"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p
                    className="text-[12px]"
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
              <div className="space-y-1.5">
                <Label
                  className="text-[13px]"
                  htmlFor={field.name}
                  style={{ color: "oklch(0.7 0.02 250)" }}
                >
                  Password
                </Label>
                <NativeInput
                  className="rounded-xl"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="At least 8 characters"
                  type="password"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p
                    className="text-[12px]"
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
          <p
            className="text-[12px]"
            style={{ color: "hsl(var(--destructive))" }}
          >
            {serverError}
          </p>
        )}

        <form.Subscribe>
          {(state) => (
            <NativeButton
              className="w-full rounded-xl"
              disabled={!state.canSubmit}
              loading={state.isSubmitting}
              type="submit"
            >
              Create Account
            </NativeButton>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <button
          className="text-[12px] underline-offset-4 transition-colors hover:underline"
          onClick={onSwitchToSignIn}
          style={{ color: "oklch(0.55 0.02 250)" }}
          type="button"
        >
          Already have an account? Sign In
        </button>
      </div>
    </div>
  );
}
