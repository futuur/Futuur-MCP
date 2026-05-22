import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface PartialSellAmountInput {
  id: number;
  shares: number;
  currency_mode?: "play_money" | "real_money";
}

async function resolveEventAndMarket(
  wagerData: any
): Promise<{ eventId: number; marketId: number } | { error: string }> {
  const parsedEventId = parseInt(wagerData.event, 10);
  if (!isNaN(parsedEventId)) {
    const eventData = await fetchFromFutuur(`events/${parsedEventId}/`, { method: "GET" });
    const parsedMarketId = parseInt(wagerData.market, 10);
    if (!isNaN(parsedMarketId)) {
      return { eventId: parsedEventId, marketId: parsedMarketId };
    }
    const market = eventData.markets?.find((m: any) => m.title === wagerData.market);
    if (!market) return { error: "Could not find the market for this wager." };
    return { eventId: parsedEventId, marketId: market.id };
  }

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

class PartialSellAmountTool extends FutuurBaseTool<PartialSellAmountInput> {
  name = "get_partial_sell_amount";
  description = `
    Simulate and calculate the amount you would receive for selling a specified number of shares in a wager, without executing the sale.
    Uses the order book to estimate the proceeds based on current bid prices.

    Common use cases:
    - When the user wants to know how much they would receive for selling part of their wager.
    - When the user asks "If I sell 10 shares of my wager, how much will I get?"

    Warning: This tool only simulates — it does NOT execute the sale. Use sell_bet to actually sell.
    Warning: The calculated amount is an estimate; actual proceeds may vary when the order is placed.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number({ required_error: "Wager ID is required." })
      ),
      description: "ID of the wager to simulate selling",
    },
    shares: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().positive()
      ),
      description: "Number of shares to simulate selling",
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]).optional(),
      description: "Currency mode. If omitted, inferred from wager currency (OOM = play_money).",
    },
  } as any;

  async execute(input: PartialSellAmountInput) {
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

      const currencyMode: "play_money" | "real_money" =
        input.currency_mode ?? (wagerData.currency === "OOM" ? "play_money" : "real_money");

      const resolved = await resolveEventAndMarket(wagerData).catch((e) => ({
        error: String(e),
      }));
      if ("error" in resolved) {
        return { content: [{ type: "text" as const, text: `Error: ${resolved.error}` }] };
      }
      const { eventId, marketId } = resolved;

      let orderBook;
      try {
        orderBook = await fetchFromFutuur(`events/${eventId}/order_book/`, {
          params: {
            market: marketId,
            currency_mode: currencyMode,
            position: wagerData.position || "l",
          },
          method: "GET",
        });
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching order book: ${String(error)}` }],
        };
      }

      const bidLevels = orderBook.bid || [];
      if (bidLevels.length === 0) {
        return {
          content: [{ type: "text" as const, text: "Error: No buyers in the order book. Cannot calculate sell amount." }],
        };
      }

      const bestBidPrice = bidLevels[0].price;
      const estimatedAmount = input.shares * bestBidPrice;

      const result = {
        wager_id: input.id,
        shares: input.shares,
        estimated_amount: estimatedAmount,
        price_per_share: bestBidPrice,
        currency: wagerData.currency || "OOM",
        currency_mode: currencyMode,
        note: "Estimate based on current order book prices. Actual proceeds may vary.",
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error getting partial sell amount: ${String(error)}` }],
      };
    }
  }
}

export default PartialSellAmountTool;
