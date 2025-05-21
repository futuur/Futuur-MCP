import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface UserBetsInput {
  limit: number;
  offset: number;
  active?: boolean;
  currency_mode: "play_money" | "real_money" | "";
  following?: boolean;
  past_bets?: boolean;
  question?: number;
  user?: number;
}

class UserBetsTool extends MCPTool<UserBetsInput> {
  name = "get_user_bets";
  description = `
    Retrieve a list of bets placed by a user, with optional filters for status, currency, and market.

    Common use cases:
    - When the user wants to see their betting history or active bets.
    - When displaying a list of bets in a dashboard or profile.
    - When the user asks "Show me my bets" or "What bets have I placed?"

    Warning: This tool may return a large result set if no filters are applied.
    Warning: It does not provide detailed information for a single bet—use a bet detail tool for that.
    Warning: If required parameters are missing, the tool may fail or return incomplete results.
  `;

  schema = {
    limit: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "Maximum number of bets to return"
    },
    offset: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "Offset for pagination"
    },
    active: {
      type: z.boolean().optional(),
      description: "Filter by active wagers (wagers with status purchased)"
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money", ""]),
      description: "Filter by currency mode"
    },
    following: {
      type: z.boolean().optional(),
      description: "Filter by bets made by users you follow"
    },
    past_bets: {
      type: z.boolean().optional(),
      description: "Filter by not active wagers (wagers with status sold, won, lost, disabled)"
    },
    question: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "Filter by question ID"
    },
    user: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "Filter by user ID"
    }
  } as any;

  async execute(input: UserBetsInput) {
    try {
      // Build query parameters
      const params: Record<string, any> = {};
      if (input.limit !== undefined) params.limit = input.limit;
      if (input.offset !== undefined) params.offset = input.offset;
      if (input.active !== undefined) params.active = input.active;
      if (input.currency_mode !== undefined) params.currency_mode = input.currency_mode;
      if (input.following !== undefined) params.following = input.following;
      if (input.past_bets !== undefined) params.past_bets = input.past_bets;
      if (input.question !== undefined) params.question = input.question;
      if (input.user !== undefined) params.user = input.user;

      const data = await fetchFromFutuur("bets", {
        params,
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
            text: `Error fetching user bets: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default UserBetsTool;