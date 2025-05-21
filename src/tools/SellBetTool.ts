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
  description = `
    Sell all or part of a bet by specifying the bet ID and optional shares or amount.

    Common use cases:
    - When the user wants to sell all or part of a bet after reviewing a simulation.
    - When executing a sale after previewing the amount to be received.
    - When the user says "Yes, sell my shares" after seeing a simulation.

    Warning: This tool executes a real sale of your bet; ensure you have simulated and confirmed before using.
    Warning: Once executed, sales cannot be undone or reversed.
    Warning: Incomplete or invalid parameters (e.g., missing bet ID) will cause the tool to fail.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "ID of the bet to sell"
    },
    shares: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().optional()
      ),
      description: "Number of shares to sell (for partial sell)"
    },
    amount: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseFloat(val) : val),
        z.number().optional()
      ),
      description: "Amount to receive (for partial sell)"
    }
  } as any;

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