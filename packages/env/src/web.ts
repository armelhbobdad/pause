import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  },
  emptyStringAsUndefined: true,
});
