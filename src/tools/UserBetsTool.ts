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
  description = "Get user bets with optional filtering";

  schema = {
    limit: {
      type: z.number(),
      description: "Maximum number of bets to return"
    },
    offset: {
      type: z.number(),
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
      type: z.number().optional(),
      description: "Filter by question ID"
    },
    user: {
      type: z.number().optional(),
      description: "Filter by user ID"
    }
  };

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