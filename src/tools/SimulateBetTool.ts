import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { SIMULATION_PAYLOAD_SOURCE_MARKER } from "../utils/toolConstants.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

// Interface for validated & structured input to the execute method
interface SimulateBetExecuteInput {
  market: number;
  currency: string;
  currency_mode: "play_money" | "real_money";
  position: "l" | "s";
  amount?: number;
  shares?: number;
  price?: number | null; // Optional limit price, null for market order
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
- market (number, required): The ID of the market to simulate an order on.
- currency (string, required): The currency for the simulation (e.g., 'OOM', 'USD', 'USDC').
- currency_mode (string, required): 'play_money' or 'real_money'.
- position (string, optional, default: 'l'): The position ('l' for long/in-favor, 's' for short/against).
- amount (number, optional): The monetary amount you want to simulate spending. Provide this OR 'shares'.
- shares (number, optional): The number of shares you want to simulate purchasing. Provide this OR 'amount'.
- price (number | null, optional): Limit price per share. If null or omitted, uses market order (best available price).

Warning: This tool ONLY simulates an order; it does NOT place an actual order. 
Warning: Always use this tool to preview the order and obtain the simulation payload before calling 'place_bet'.
Warning: You must provide either 'amount' or 'shares'. If neither or both are provided, the tool will return an error.
  `;

  schema = {
    market: {
      type: z.preprocess(
        (val: unknown) => (typeof val === 'string' ? parseInt(val, 10) : val),
        z.number({ required_error: "Market ID (market) is required." })
      ),
      description: "ID of the market to simulate an order on."
    },
    currency: {
      type: z.string().max(11).default("OOM"),
      description: "Currency for the simulation (e.g., 'OOM', 'USD', 'USDC')."
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]),
      description: "Currency mode: 'play_money' or 'real_money'."
    },
    position: {
      type: z.enum(["l", "s"]).default("l"),
      description: "Order position: 'l' for long (in favor), 's' for short (against)."
    },
    amount: {
      type: z.number().positive().optional(),
      description: "Monetary amount to simulate spending. Provide this OR shares."
    },
    shares: {
      type: z.number().positive().optional(),
      description: "Number of shares to simulate purchasing. Provide this OR amount."
    },
    price: {
      type: z.union([z.number().min(0).max(1), z.null()]).optional(),
      description: "Limit price per share (0-1). If null or omitted, uses market order (best available price)."
    }
  } as any;

  async execute(input: SimulateBetExecuteInput) {
    try {
      // Custom validation: ensure either amount or shares is provided, but not both
      const amountProvided = input.amount !== undefined;
      const sharesProvided = input.shares !== undefined;

      if (!amountProvided && !sharesProvided) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Either 'amount' or 'shares' must be provided for the simulation."
          }]
        };
      }

      if (amountProvided && sharesProvided) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Please provide either 'amount' or 'shares' for the simulation, not both."
          }]
        };
      }

      // First, get the event that contains this market to get the event ID
      let eventData;
      try {
        // Search for events containing this market
        const eventsResponse = await fetchFromFutuur("events/", {
          params: { limit: 100 },
          method: "GET"
        });
        
        // Find the event that contains our market
        const event = eventsResponse.results?.find((e: any) => 
          e.markets?.some((m: any) => m.id === input.market)
        );
        
        if (!event) {
          return {
            content: [{
              type: "text" as const,
              text: "Error: Could not find the event for the specified market ID."
            }]
          };
        }
        
        eventData = event;
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Unable to verify event details. Please try again later."
          }]
        };
      }

      // Check if order_book_enabled is true (required for v2.0)
      if (!eventData.order_book_enabled) {
        return {
          content: [{
            type: "text" as const,
            text: "⚠️ **Order Book Not Enabled**\n\nThis event does not support order book trading. Order book must be enabled for limit orders.\n\nPlease try betting on events that have order book trading enabled."
          }]
        };
      }

      // Get order book data
      let orderBook;
      try {
        orderBook = await fetchFromFutuur(`events/${eventData.id}/order_book/`, {
          params: {
            market: input.market,
            currency_mode: input.currency_mode,
            position: input.position,
          },
          method: "GET"
        });
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error fetching order book: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }

      // Determine best price from order book
      // For buying (bid), we look at ask levels (what sellers are asking)
      // For selling (ask), we look at bid levels (what buyers are bidding)
      const side = "bid"; // We're simulating a purchase, so it's a bid
      const askLevels = orderBook.ask || [];
      const bidLevels = orderBook.bid || [];
      
      // Get best available price
      let bestPrice: number | null = null;
      if (side === "bid" && askLevels.length > 0) {
        // Best ask price (lowest price sellers are willing to accept)
        bestPrice = askLevels[0].price;
      } else if (side === "ask" && bidLevels.length > 0) {
        // Best bid price (highest price buyers are willing to pay)
        bestPrice = bidLevels[0].price;
      }

      // Use provided price or best available price
      const orderPrice = input.price !== undefined ? input.price : bestPrice;

      if (orderPrice === null && !bestPrice) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: No available prices in the order book for this market. Cannot simulate order."
          }]
        };
      }

      // Calculate shares or amount
      let calculatedShares: number;
      let calculatedAmount: number;

      if (input.amount !== undefined) {
        // Calculate shares from amount
        const priceToUse = orderPrice || bestPrice || 0;
        calculatedShares = input.amount / priceToUse;
        calculatedAmount = input.amount;
      } else if (input.shares !== undefined) {
        // Calculate amount from shares
        const priceToUse = orderPrice || bestPrice || 0;
        calculatedAmount = input.shares * priceToUse;
        calculatedShares = input.shares;
      } else {
        // This shouldn't happen due to validation above, but TypeScript needs this
        throw new Error("Either amount or shares must be provided");
      }

      // Build simulation payload matching AddLimitOrder schema
      const simulationData = {
        market: input.market,
        side: side,
        position: input.position,
        price: orderPrice,
        shares: calculatedShares,
        amount: calculatedAmount,
        currency: input.currency,
        tool_source: SIMULATION_PAYLOAD_SOURCE_MARKER,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(simulationData, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error simulating order: ${errorMessage}`,
          },
        ],
      };
    }
  }
}

export default SimulateBetTool;
