import "server-only";
import { tool } from "ai";
import z from "zod";
import { searchCoupons } from "./coupon-provider";
import { selectBestOffer } from "./offer-selection";

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
      const bestOffer = selectBestOffer(results, price);
      return {
        bestOffer,
        allResultsCount: results.length,
        selectionReasoning: bestOffer?.selectionReasoning ?? "No offers found",
      };
    } catch (error) {
      // TODO(Epic-4): Replace with structured Opik trace logging
      console.warn("[Guardian] Coupon search failed:", error);
      return {
        bestOffer: null,
        allResultsCount: 0,
        selectionReasoning: "Coupon search unavailable",
      };
    }
  },
});
