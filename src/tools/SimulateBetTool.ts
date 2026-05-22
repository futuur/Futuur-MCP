import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { SIMULATION_PAYLOAD_SOURCE_MARKER } from "../utils/toolConstants.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface SimulateBetExecuteInput {
  event_id: number;
  market: number;
  currency: string;
  currency_mode: "play_money" | "real_money";
  position: "l" | "s";
  amount?: number;
  shares?: number;
  price?: number | null;
}

class SimulateBetTool extends FutuurBaseTool<SimulateBetExecuteInput> {
  name = "get_bet_simulation";
  description = `
Simulates a limit order purchase on a specific market without actually placing the order.
This tool uses the order book endpoint to calculate potential costs and shares.
It helps preview the potential cost if specifying shares, or the potential shares if specifying an amount.
This tool should be called first to get a preview and the exact payload for the 'place_bet' tool.

Use cases:
- Previewing order details: "How many shares of market X can I get for 100 OOM?"
- Previewing order costs: "What is the cost for 50 shares of market Y?"
- Getting the necessary payload for the 'place_bet' tool after user confirmation.

Parameters:
- event_id (number, required): The ID of the event that contains the market. Get this from get_markets or get_market_details.
- market (number, required): The ID of the specific market (outcome) within the event.
- currency (string, required): The currency for the simulation (e.g., 'OOM', 'USD', 'USDC').
- currency_mode (string, required): 'play_money' or 'real_money'.
- position (string, optional, default: 'l'): The position ('l' for long/in-favor, 's' for short/against).
- amount (number, optional): The monetary amount you want to simulate spending. Provide this OR 'shares'.
- shares (number, optional): The number of shares you want to simulate purchasing. Provide this OR 'amount'.
- price (number | null, optional): Limit price per share (0-1). If null or omitted, uses market order (best available price).

Warning: This tool ONLY simulates an order; it does NOT place an actual order.
Warning: Always use this tool to preview the order and obtain the simulation payload before calling 'place_bet'.
Warning: You must provide either 'amount' or 'shares'. If neither or both are provided, the tool will return an error.
  `;

  schema = {
    event_id: {
      type: z.preprocess(
        (val: unknown) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number({ required_error: "Event ID (event_id) is required. Get it from get_markets or get_market_details." })
      ),
      description: "ID of the event containing the market. Get this from get_markets or get_market_details.",
    },
    market: {
      type: z.preprocess(
        (val: unknown) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number({ required_error: "Market ID (market) is required." })
      ),
      description: "ID of the market (outcome) to simulate an order on.",
    },
    currency: {
      type: z.string().max(11).default("OOM"),
      description: "Currency for the simulation (e.g., 'OOM', 'USD', 'USDC').",
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]),
      description: "Currency mode: 'play_money' or 'real_money'.",
    },
    position: {
      type: z.enum(["l", "s"]).default("l"),
      description: "Order position: 'l' for long (in favor), 's' for short (against).",
    },
    amount: {
      type: z.number().positive().optional(),
      description: "Monetary amount to simulate spending. Provide this OR shares.",
    },
    shares: {
      type: z.number().positive().optional(),
      description: "Number of shares to simulate purchasing. Provide this OR amount.",
    },
    price: {
      type: z.union([z.number().min(0).max(1), z.null()]).optional(),
      description: "Limit price per share (0-1). If null or omitted, uses market order (best available price).",
    },
  } as any;

  async execute(input: SimulateBetExecuteInput) {
    try {
      const amountProvided = input.amount !== undefined;
      const sharesProvided = input.shares !== undefined;

      if (!amountProvided && !sharesProvided) {
        return {
          content: [{ type: "text" as const, text: "Error: Either 'amount' or 'shares' must be provided for the simulation." }],
        };
      }
      if (amountProvided && sharesProvided) {
        return {
          content: [{ type: "text" as const, text: "Error: Please provide either 'amount' or 'shares', not both." }],
        };
      }

      // Fetch event directly using the provided event_id
      let eventData;
      try {
        eventData = await fetchFromFutuur(`events/${input.event_id}/`, { method: "GET" });
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: Could not fetch event ${input.event_id}. Please verify the event ID.` }],
        };
      }

      if (!eventData.order_book_enabled) {
        return {
          content: [{ type: "text" as const, text: "⚠️ **Order Book Not Enabled**\n\nThis event does not support order book trading. Order book must be enabled for limit orders.\n\nPlease try betting on events that have order book trading enabled." }],
        };
      }

      // Get order book data
      let orderBook;
      try {
        orderBook = await fetchFromFutuur(`events/${input.event_id}/order_book/`, {
          params: {
            market: input.market,
            currency_mode: input.currency_mode,
            position: input.position,
          },
          method: "GET",
        });
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching order book: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }

      const side = "bid" as const;
      const askLevels = orderBook.ask || [];

      let bestPrice: number | null = null;
      if (askLevels.length > 0) {
        bestPrice = askLevels[0].price;
      }

      const orderPrice = input.price !== undefined ? input.price : bestPrice;

      if (orderPrice === null && !bestPrice) {
        return {
          content: [{ type: "text" as const, text: "Error: No available prices in the order book for this market. Cannot simulate order." }],
        };
      }

      let calculatedShares: number;
      let calculatedAmount: number;

      if (input.amount !== undefined) {
        const priceToUse = orderPrice || bestPrice || 0;
        calculatedShares = input.amount / priceToUse;
        calculatedAmount = input.amount;
      } else {
        const priceToUse = orderPrice || bestPrice || 0;
        calculatedAmount = input.shares! * priceToUse;
        calculatedShares = input.shares!;
      }

      const simulationData = {
        market: input.market,
        side,
        position: input.position,
        price: orderPrice,
        shares: calculatedShares,
        amount: calculatedAmount,
        currency: input.currency,
        tool_source: SIMULATION_PAYLOAD_SOURCE_MARKER,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(simulationData, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error simulating order: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  }
}

export default SimulateBetTool;
