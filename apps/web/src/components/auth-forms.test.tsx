import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUTTON_IMPORT_RE = /from\s+["']\.\/ui\/button["']/;

describe("Auth Forms Glassmorphism Rebrand (Story 10.4)", () => {
  const signInSource = readFileSync(
    resolve(__dirname, "./sign-in-form.tsx"),
    "utf-8"
  );
  const signUpSource = readFileSync(
    resolve(__dirname, "./sign-up-form.tsx"),
    "utf-8"
  );

  describe("SignInForm", () => {
    it("uses NativeButton instead of plain Button for submit", () => {
      expect(signInSource).toContain("NativeButton");
      expect(signInSource).not.toMatch(BUTTON_IMPORT_RE);
    });

    it("applies glassmorphism CSS via inline styles", () => {
      expect(signInSource).toContain("--pause-glass");
      expect(signInSource).toContain("--pause-blur-medium");
    });

    it("has glass-panel class and data-glass attribute", () => {
      expect(signInSource).toContain("glass-panel");
      expect(signInSource).toContain("data-glass");
    });

    it("has max-width 480px", () => {
      expect(signInSource).toContain("max-w-[480px]");
    });

    it("passes loading prop to NativeButton", () => {
      expect(signInSource).toContain("loading={state.isSubmitting}");
    });

    it("redirects to /dashboard on success without toast", () => {
      expect(signInSource).toContain('router.push("/dashboard")');
      expect(signInSource).not.toContain("toast.success");
    });

    it("uses destructive color for inline validation errors", () => {
      expect(signInSource).toContain("--destructive");
    });
  });

  describe("SignUpForm", () => {
    it("uses NativeButton instead of plain Button for submit", () => {
      expect(signUpSource).toContain("NativeButton");
      expect(signUpSource).not.toMatch(BUTTON_IMPORT_RE);
    });

    it("applies glassmorphism CSS via inline styles", () => {
      expect(signUpSource).toContain("--pause-glass");
      expect(signUpSource).toContain("--pause-blur-medium");
    });

    it("redirects to /dashboard on success without toast", () => {
      expect(signUpSource).toContain('router.push("/dashboard")');
      expect(signUpSource).not.toContain("toast.success");
    });
  });
});
