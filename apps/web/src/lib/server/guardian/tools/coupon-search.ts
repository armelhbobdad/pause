import "server-only";
import { tool } from "ai";
import z from "zod";
import { searchCoupons } from "./coupon-provider";

const SEARCH_TIMEOUT_MS = 2000;

export const searchCouponsTool = tool({
  description:
    "Search for applicable deals, coupons, or promo codes for a purchase",
  inputSchema: z.object({
    merchant: z.string().describe("The merchant or store name"),
    category: z
      .string()
      .describe("Product category (e.g., electronics, fashion, grocery)"),
    productName: z
      .string()
      .optional()
      .describe("Specific product name if known"),
    price: z.number().optional().describe("Price in dollars if known"),
  }),
  execute: async ({ merchant, category, productName, price }) => {
    try {
      const results = await Promise.race([
        searchCoupons({ merchant, category, productName, price }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Coupon search timed out")),
            SEARCH_TIMEOUT_MS
          )
        ),
      ]);
      return { results };
    } catch (error) {
      console.warn("[Guardian] Coupon search failed:", error);
      return { results: [], error: "Coupon search unavailable" };
    }
  },
});
