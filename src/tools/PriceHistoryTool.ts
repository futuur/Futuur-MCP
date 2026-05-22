import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface PriceHistoryInput {
  id: number;
  currency_mode: "play_money" | "real_money";
  time_interval?: "day" | "week" | "month" | "year" | "all_time";
}

class PriceHistoryTool extends FutuurBaseTool<PriceHistoryInput> {
  name = "get_price_history";
  description = `
    Retrieve historical price data for an event's markets over a specified time interval.

    Useful for charting price trends or analysing how market sentiment has shifted over time.

    Common use cases:
    - When the user asks "How has the price changed over time for event X?"
    - When building a price chart or trend analysis for a prediction market.
    - When comparing current prices to historical prices.

    Warning: You must provide the event ID (not the market ID). Get it from get_markets or get_market_details.
    Warning: currency_mode is required.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number({ required_error: "Event ID is required." })
      ),
      description: "The unique integer ID of the event",
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]),
      description: "Currency mode: 'play_money' or 'real_money'",
    },
    time_interval: {
      type: z
        .enum(["day", "week", "month", "year", "all_time"])
        .optional(),
      description: "Time range for price history. Defaults to 'all_time' if omitted.",
    },
  } as any;

  async execute(input: PriceHistoryInput) {
    try {
      const params: Record<string, any> = {
        currency_mode: input.currency_mode,
      };
      if (input.time_interval) {
        params.time_interval = input.time_interval;
      }

      const data = await fetchFromFutuur(`events/${input.id}/price_history/`, {
        params,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching price history for event ${input.id}: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default PriceHistoryTool;
