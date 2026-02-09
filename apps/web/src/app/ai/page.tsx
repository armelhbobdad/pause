import { redirect } from "next/navigation";

/**
 * The /ai page has been replaced by the floating chat widget (Story 10.6).
 * Redirect any direct visits to the dashboard.
 */
export default function AIPage() {
  redirect("/dashboard");
}
