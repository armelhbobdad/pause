import { protectedProcedure, publicProcedure, router } from "../index";
import { dashboardRouter } from "./dashboard";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  dashboard: dashboardRouter,
});
export type AppRouter = typeof appRouter;
