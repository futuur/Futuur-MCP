import { z } from "zod";
import { createLimitOrder, fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface SellBetInput {
  id: number;
  shares?: number;
  price?: number | null;
  currency_mode?: "play_money" | "real_money";
}

async function resolveEventAndMarket(
  wagerData: any
): Promise<{ eventId: number; marketId: number } | { error: string }> {
  // Try to use wager.event and wager.market as integer IDs first (fast path)
  const parsedEventId = parseInt(wagerData.event, 10);
  if (!isNaN(parsedEventId)) {
    const eventData = await fetchFromFutuur(`events/${parsedEventId}/`, { method: "GET" });
    const parsedMarketId = parseInt(wagerData.market, 10);
    if (!isNaN(parsedMarketId)) {
      return { eventId: parsedEventId, marketId: parsedMarketId };
    }
    // market field is a title string — find it inside the event
    const market = eventData.markets?.find(
      (m: any) => m.title === wagerData.market
    );
    if (!market) return { error: "Could not find the market for this wager." };
    return { eventId: parsedEventId, marketId: market.id };
  }

  // Fall back: search by title across first 100 events
  const eventsResponse = await fetchFromFutuur("events/", {
    params: { limit: 100 },
    method: "GET",
  });
  const event = eventsResponse.results?.find(
    (e: any) => e.id.toString() === wagerData.event || e.title === wagerData.event
  );
  if (!event) return { error: "Could not find the event for this wager." };

  const market = event.markets?.find(
    (m: any) => m.id.toString() === wagerData.market || m.title === wagerData.market
  );
  if (!market) return { error: "Could not find the market for this wager." };

  return { eventId: event.id, marketId: market.id };
}

class SellBetTool extends FutuurBaseTool<SellBetInput> {
  name = "sell_bet";
  description = `
    Sell all or part of a wager by creating an ask order.
    This tool retrieves the wager details, then creates an "ask" limit order to sell the specified shares.

    Common use cases:
    - When the user wants to sell all or part of a wager.
    - When the user says "Sell my position on wager #X."

    Warning: This tool executes a real sale by creating an order; ensure the user has confirmed before using.
    Warning: Once executed, orders cannot be undone (though they can be cancelled if still open via cancel_order).
    Warning: Use get_partial_sell_amount first to preview how much the user will receive.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number({ required_error: "Wager ID is required." })
      ),
      description: "ID of the wager to sell",
    },
    shares: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().positive().optional()
      ),
      description: "Number of shares to sell. If omitted, sells all shares in the wager.",
    },
    price: {
      type: z.union([z.number().min(0).max(1), z.null()]).optional(),
      description: "Limit price per share (0-1). If null or omitted, uses market order (best available price).",
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]).optional(),
      description: "Currency mode. If omitted, inferred from wager currency (OOM = play_money).",
    },
  } as any;

  async execute(input: SellBetInput) {
    try {
      let wagerData;
      try {
        wagerData = await fetchFromFutuur(`wagers/${input.id}/`, { method: "GET" });
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching wager details: ${String(error)}` }],
        };
      }

      if (!wagerData) {
        return { content: [{ type: "text" as const, text: "Error: Wager not found." }] };
      }

      const resolved = await resolveEventAndMarket(wagerData).catch((e) => ({
        error: String(e),
      }));
      if ("error" in resolved) {
        return { content: [{ type: "text" as const, text: `Error: ${resolved.error}` }] };
      }
      const { marketId } = resolved;

      const sharesToSell = input.shares !== undefined ? input.shares : Math.abs(wagerData.shares || 0);
      if (sharesToSell <= 0) {
        return { content: [{ type: "text" as const, text: "Error: No shares to sell or invalid share amount." }] };
      }

      const currencyMode: "play_money" | "real_money" =
        input.currency_mode ?? (wagerData.currency === "OOM" ? "play_money" : "real_money");

      const orderPayload = {
        market: marketId,
        side: "ask" as const,
        position: wagerData.position || "l",
        price: input.price !== undefined ? input.price : null,
        shares: sharesToSell,
        currency: wagerData.currency || (currencyMode === "play_money" ? "OOM" : "USDC"),
      };

      const data = await createLimitOrder(orderPayload);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error selling wager: ${String(error)}` }],
      };
    }
  }
}

export default SellBetTool;
