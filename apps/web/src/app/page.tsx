import { auth } from "@pause/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LandingHero } from "@/components/landing-hero";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LandingHero />;
}
