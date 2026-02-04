import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface PartialSellAmountInput {
  id: number;
  shares: number;
  currency_mode?: "play_money" | "real_money";
}

class PartialSellAmountTool extends FutuurBaseTool<PartialSellAmountInput> {
  name = "get_partial_sell_amount";
  description = `
    Simulate and calculate the amount you would receive for partially selling a specified number of shares in a wager, without executing the sale.
    This tool uses the order book to calculate the estimated amount based on current market prices.

    Common use cases:
    - When the user wants to know how much they would receive for selling part of their wager.
    - When planning a partial sale before actually executing it.
    - When the user asks "If I sell 10 shares of my wager, how much will I get?"

    Warning: This tool only simulates the amount you would receive; it does not execute the sale.
    Warning: Both the wager ID and the number of shares to sell must be specified.
    Warning: The calculated amount is an estimate based on current order book prices and may vary when the order is actually placed.
    Warning: Use the actual sell tool to execute a sale after reviewing the simulation.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "ID of the wager"
    },
    shares: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().positive()
      ),
      description: "Number of shares to sell"
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]).optional(),
      description: "Currency mode. If not provided, will be determined from wager currency."
    }
  } as any;

  async execute(input: PartialSellAmountInput) {
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

      // Get event and market details
      let marketId: number;
      let eventId: number;
      let currencyMode: "play_money" | "real_money";
      
      try {
        // Determine currency mode
        currencyMode = input.currency_mode || (wagerData.currency === "OOM" ? "play_money" : "real_money");
        
        // Get event ID from wager
        const eventsResponse = await fetchFromFutuur("events/", {
          params: { limit: 100 },
          method: "GET"
        });
        
        // Find event by matching the event string from wager
        const event = eventsResponse.results?.find((e: any) => 
          e.id.toString() === wagerData.event || e.title === wagerData.event
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

      // Get order book to calculate sell amount
      let orderBook;
      try {
        orderBook = await fetchFromFutuur(`events/${eventId}/order_book/`, {
          params: {
            market: marketId,
            currency_mode: currencyMode,
            position: wagerData.position || "l",
          },
          method: "GET"
        });
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching order book: ${String(error)}`
          }]
        };
      }

      // For selling (ask), we look at bid levels (what buyers are willing to pay)
      const bidLevels = orderBook.bid || [];
      
      if (bidLevels.length === 0) {
        return {
          content: [{
            type: "text",
            text: "Error: No buyers in the order book. Cannot calculate sell amount."
          }]
        };
      }

      // Get best bid price (highest price buyers are willing to pay)
      const bestBidPrice = bidLevels[0].price;
      
      // Calculate estimated amount
      const estimatedAmount = input.shares * bestBidPrice;

      // Return simulation result
      const result = {
        wager_id: input.id,
        shares: input.shares,
        estimated_amount: estimatedAmount,
        price_per_share: bestBidPrice,
        currency: wagerData.currency || "OOM",
        currency_mode: currencyMode,
        note: "This is an estimate based on current order book prices. Actual amount may vary when order is placed."
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting partial sell amount: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default PartialSellAmountTool;
