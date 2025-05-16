import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface RatesInput {
  base_currency?: string;
}

class RatesTool extends MCPTool<RatesInput> {
  name = "get_exchange_rates";
  description = `
    Retrieve the latest exchange rates for supported currencies.

    Common use cases:
    - When the user wants to see current exchange rates for supported currencies.
    - When displaying conversion rates in a UI.
    - When the user asks "What are the current exchange rates?"

    Warning: This tool only provides current exchange rates; it does not perform any currency conversion.
    Warning: Rates are subject to change and may not reflect real-time market conditions.
    Warning: Historical rates are not available through this tool.
  `;

  schema = {
    base_currency: {
      type: z.string().optional(),
      description: "Optional base currency to filter rates"
    }
  };

  async execute(input: RatesInput) {
    try {
      const rates = await fetchFromFutuur("bets/rates/");
      if (input.base_currency) {
        const baseRates = rates.find((r: { currency: string }) => r.currency === input.base_currency);
        if (!baseRates) {
          throw new Error(`Rates for ${input.base_currency} not found`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(baseRates, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rates, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting exchange rates: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default RatesTool;