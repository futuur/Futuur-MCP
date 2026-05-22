import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface ConvertToUsdInput {
  value: number;
  from_currency: string;
}

class ConvertToUsdTool extends MCPTool<ConvertToUsdInput> {
  name = "convert_to_usd";
  description = `
    Simulate and calculate the amount you would receive when converting a specified amount from a given currency to USD, using current exchange rates, without executing the conversion.

    Common use cases:
    - When the user wants to know how much a given currency amount is in USD.
    - When displaying USD equivalents for bets or balances.
    - When the user asks "How much is 0.01 BTC in USD?"

    Warning: This tool only simulates the conversion; it does not actually transfer or exchange funds.
    Warning: Both the amount and the source currency must be specified.
    Warning: Exchange rates may fluctuate; always check for the latest rates.
  `;

  schema = {
    value: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().positive()
      ),
      description: "Amount to convert to USD"
    },
    from_currency: {
      type: z.string(),
      description: "Source currency code"
    }
  } as any;

  async execute(_input: ConvertToUsdInput) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Currency conversion is not available in Futuur API v2.0. The exchange rates endpoint (bets/rates/) no longer exists. Supported currencies are: OOM (play money), USDC, USDT, USD.",
        },
      ],
    };
  }
}

export default ConvertToUsdTool;