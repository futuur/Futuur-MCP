import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface ConvertFromUsdInput {
  value: number;
  to_currency: string;
}

class ConvertFromUsdTool extends MCPTool<ConvertFromUsdInput> {
  name = "convert_from_usd";
  description = `
    Simulate and calculate the amount you would receive when converting a specified USD amount to a target currency, using current exchange rates, without executing the conversion.

    Common use cases:
    - When the user wants to know how much a USD amount is in another currency.
    - When displaying currency conversions for bets or balances.
    - When the user asks "How much is $5 in BTC?"

    Warning: This tool only simulates the conversion; it does not actually transfer or exchange funds.
    Warning: Both the USD amount and the target currency must be specified.
    Warning: Exchange rates may fluctuate; always check for the latest rates.
  `;

  schema = {
    value: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().positive()
      ),
      description: "Amount in USD to convert"
    },
    to_currency: {
      type: z.string(),
      description: "Target currency code"
    }
  } as any;

  async execute(_input: ConvertFromUsdInput) {
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

export default ConvertFromUsdTool;