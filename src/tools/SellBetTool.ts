import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface SellBetInput {
  id: number;
  shares?: number;
  amount?: number;
}

class SellBetTool extends MCPTool<SellBetInput> {
  name = "sell_bet";
  description = "Sell a bet (full or partial)";

  schema = {
    id: {
      type: z.number().describe(''),
      description: "ID of the bet to sell"
    },
    shares: {
      type: z.number().optional(),
      description: "Number of shares to sell (for partial sell)"
    },
    amount: {
      type: z.number().optional(),
      description: "Amount to receive (for partial sell)"
    }
  };

  async execute(input: SellBetInput) {
    try {
      const requestBody: Record<string, any> = {};

      // For partial sell, include shares and/or amount
      if (input.shares !== undefined) requestBody.shares = input.shares;
      if (input.amount !== undefined) requestBody.amount = input.amount;

      const data = await fetchFromFutuur(`bets/${input.id}`, {
        method: "PATCH",
        body: Object.keys(requestBody).length > 0 ? requestBody : undefined,
      });

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
            text: `Error selling bet: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default SellBetTool;