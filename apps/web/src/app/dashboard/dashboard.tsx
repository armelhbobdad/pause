"use client";
import { useQuery } from "@tanstack/react-query";

import type { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function Dashboard({
  // biome-ignore lint/correctness/noUnusedFunctionParameters: reserved for user-specific dashboard content
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const privateData = useQuery(trpc.privateData.queryOptions());

  return <p>API: {privateData.data?.message}</p>;
}
