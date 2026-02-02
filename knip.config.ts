import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      ignoreDependencies: ["@pause/env", "@pause/config"],
    },
    "apps/web": {
      entry: [
        "src/app/**/{page,layout,loading,error,not-found,default,template,route,middleware}.{ts,tsx}",
      ],
      // shadcn UI components export more than consumed — that's by design
      ignore: ["src/components/ui/**"],
    },
    "packages/config": {
      entry: [],
    },
  },
};

export default config;
