import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface ConvertToUsdInput {
  value: number;
  from_currency: string;
}

class ConvertToUsdTool extends MCPTool<ConvertToUsdInput> {
  name = "convert_to_usd";
  description = "Convert to USD from another currency";

  schema = {
    value: {
      type: z.number().positive(),
      description: "Amount to convert to USD"
    },
    from_currency: {
      type: z.string(),
      description: "Source currency code"
    }
  };

  async execute(input: ConvertToUsdInput) {
    try {
      const rates = await fetchFromFutuur("bets/rates/");
      const usdRates = rates.find((r: { currency: string }) => r.currency === "USD");
      if (!usdRates) {
        throw new Error("USD rates not found");
      }

      const inUsd = 1 / usdRates.rates[input.from_currency];
      const result = inUsd * input.value;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                from_amount: input.value,
                from_currency: input.from_currency,
                to_amount: result,
                to_currency: "USD",
                rate: inUsd,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error converting to USD: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default ConvertToUsdTool;