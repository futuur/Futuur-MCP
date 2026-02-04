import { z } from "zod";
import { createLimitOrder, fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface SellBetInput {
  id: number;
  shares?: number;
  amount?: number;
  price?: number | null; // Optional limit price, null for market order
  currency_mode?: "play_money" | "real_money";
}

class SellBetTool extends FutuurBaseTool<SellBetInput> {
  name = "sell_bet";
  description = `
    Sell all or part of a wager by creating an ask order. In v2.0 API, selling is done through limit orders.
    This tool retrieves the wager details, then creates an "ask" order to sell the specified shares.

    Common use cases:
    - When the user wants to sell all or part of a wager.
    - When executing a sale after previewing the amount to be received.
    - When the user says "Yes, sell my shares" after seeing a simulation.

    Warning: This tool executes a real sale by creating an order; ensure you have confirmed before using.
    Warning: Once executed, orders cannot be undone (though they can be cancelled if still open).
    Warning: Incomplete or invalid parameters (e.g., missing wager ID) will cause the tool to fail.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "ID of the wager to sell"
    },
    shares: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().positive().optional()
      ),
      description: "Number of shares to sell (for partial sell). If not provided, sells all shares."
    },
    amount: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().positive().optional()
      ),
      description: "Amount to receive (for partial sell). If provided, shares will be calculated from order book."
    },
    price: {
      type: z.union([z.number().min(0).max(1), z.null()]).optional(),
      description: "Limit price per share (0-1). If null or omitted, uses market order (best available price)."
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]).optional(),
      description: "Currency mode. If not provided, will be determined from wager currency."
    }
  } as any;

  async execute(input: SellBetInput) {
    try {
      // First, get the wager details to extract market, position, currency
      let wagerData;
      try {
        wagerData = await fetchFromFutuur(`wagers/${input.id}/`, {
          method: "GET"
        });
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching wager details: ${String(error)}`
          }]
        };
      }

      if (!wagerData) {
        return {
          content: [{
            type: "text",
            text: "Error: Wager not found."
          }]
        };
      }

      // Extract market ID from wager (wager has a market field that's a string, need to parse or get from event)
      // The wager.market field might be a string like "Market Title" or an ID
      // We need to get the actual market ID. Let's get the event first.
      let marketId: number;
      let eventId: number;
      
      try {
        // Get event ID from wager (wager.event is a string, we need to find the event)
        const eventIdStr = wagerData.event;
        // Try to extract event ID - it might be in the format "Event Title" or a URL
        // For now, let's search for events containing this wager's market
        const eventsResponse = await fetchFromFutuur("events/", {
          params: { limit: 100 },
          method: "GET"
        });
        
        // Find event by matching the event string from wager
        const event = eventsResponse.results?.find((e: any) => 
          e.id.toString() === eventIdStr || e.title === eventIdStr
        );
        
        if (!event) {
          return {
            content: [{
              type: "text",
              text: "Error: Could not find the event for this wager."
            }]
          };
        }
        
        eventId = event.id;
        
        // Find market by matching the market string from wager
        const market = event.markets?.find((m: any) => 
          m.id.toString() === wagerData.market || m.title === wagerData.market
        );
        
        if (!market) {
          return {
            content: [{
              type: "text",
              text: "Error: Could not find the market for this wager."
            }]
          };
        }
        
        marketId = market.id;
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error finding market for wager: ${String(error)}`
          }]
        };
      }

      // Determine shares to sell
      let sharesToSell: number;
      if (input.shares !== undefined) {
        sharesToSell = input.shares;
      } else if (input.amount !== undefined) {
        // If amount is provided, we'd need to get order book to calculate shares
        // For now, return an error asking for shares
        return {
          content: [{
            type: "text",
            text: "Error: Please specify 'shares' to sell. Amount-based selling requires order book lookup which is not yet implemented in this tool."
          }]
        };
      } else {
        // Sell all shares
        sharesToSell = Math.abs(wagerData.shares || 0);
      }

      if (sharesToSell <= 0) {
        return {
          content: [{
            type: "text",
            text: "Error: No shares to sell or invalid share amount."
          }]
        };
      }

      // Determine currency mode
      let currencyMode: "play_money" | "real_money" = input.currency_mode || "play_money";
      // Try to determine from currency - OOM is typically play_money
      if (!input.currency_mode && wagerData.currency) {
        currencyMode = wagerData.currency === "OOM" ? "play_money" : "real_money";
      }

      // Create ask order to sell
      const orderPayload = {
        market: marketId,
        side: "ask" as const, // Selling
        position: wagerData.position || "l", // Same position as wager to close it
        price: input.price !== undefined ? input.price : null, // Market order if not specified
        shares: sharesToSell,
        currency: wagerData.currency || "OOM",
      };

      const data = await createLimitOrder(orderPayload);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error selling wager: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default SellBetTool;
