import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface PartialSellAmountInput {
  id: number;
  shares: number;
}

class PartialSellAmountTool extends MCPTool<PartialSellAmountInput> {
  name = "get_partial_sell_amount";
  description = "Get the amount for a partial sell of a bet";

  schema = {
    id: {
      type: z.number(),
      description: "ID of the bet"
    },
    shares: {
      type: z.number(),
      description: "Number of shares to sell"
    }
  };

  async execute(input: PartialSellAmountInput) {
    try {
      const data = await fetchFromFutuur(
        `bets/${input.id}/get_partial_amount_on_sell/`,
        {
          params: { shares: input.shares },
        }
      );

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
            text: `Error getting partial sell amount: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default PartialSellAmountTool;