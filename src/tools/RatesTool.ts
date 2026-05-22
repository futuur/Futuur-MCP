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

    Warning: The exchange rates endpoint (bets/rates/) is not available in API v2.0.
    This tool is kept for backwards compatibility but will return an error.
    Futuur v2.0 supports these currencies: OOM (play money), USDC, USDT, USD.
  `;

  schema = {
    base_currency: {
      type: z.string().optional(),
      description: "Optional base currency to filter rates"
    }
  };

  async execute(_input: RatesInput) {
    return {
      content: [
        {
          type: "text" as const,
          text: "The exchange rates endpoint (bets/rates/) is not available in Futuur API v2.0. Supported currencies are: OOM (play money), USDC, USDT, USD.",
        },
      ],
    };
  }
}

export default RatesTool;