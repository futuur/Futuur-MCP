import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface WagerDetailInput {
  id: number;
}

class WagerDetailTool extends FutuurBaseTool<WagerDetailInput> {
  name = "get_wager_details";
  description = `
    Retrieve detailed information about a specific wager (bet position) by its ID.

    Returns full details including status, shares, earnings, ROI, purchase history, and market info.

    Common use cases:
    - When the user wants detailed info about a specific wager.
    - When investigating a particular position's performance.
    - When the user asks "Show me details for wager #123."

    Warning: You must provide a valid wager ID that belongs to the authenticated user.
    Warning: Use get_user_bets first to find wager IDs if you don't have them.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number({ required_error: "Wager ID is required." })
      ),
      description: "The unique integer ID of the wager to retrieve",
    },
  } as any;

  async execute(input: WagerDetailInput) {
    try {
      const data = await fetchFromFutuur(`wagers/${input.id}/`);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error fetching wager ${input.id}: ${String(error)}` },
        ],
      };
    }
  }
}

export default WagerDetailTool;
