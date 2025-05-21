import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface PartialSellAmountInput {
  id: number;
  shares: number;
}

class PartialSellAmountTool extends MCPTool<PartialSellAmountInput> {
  name = "get_partial_sell_amount";
  description = `
    Simulate and calculate the amount you would receive for partially selling a specified number of shares in a bet, without executing the sale.

    Common use cases:
    - When the user wants to know how much they would receive for selling part of their bet.
    - When planning a partial sale before actually executing it.
    - When the user asks "If I sell 10 shares of my bet, how much will I get?"

    Warning: This tool only simulates the amount you would receive; it does not execute the sale.
    Warning: Both the bet ID and the number of shares to sell must be specified.
    Warning: Use the actual sell tool to execute a sale after reviewing the simulation.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "ID of the bet"
    },
    shares: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number()
      ),
      description: "Number of shares to sell"
    }
  } as any;

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