import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface ListOrdersInput {
  categories?: number[];
  currencies?: string[];
  currency?: string;
  currency_mode?: "play_money" | "real_money";
  event?: number;
  limit?: number;
  market?: number;
  offset?: number;
  ordering?: string;
  search?: string;
  side?: "bid" | "ask";
  status?: "open" | "partial_filled" | "filled" | "canceled" | "processing";
}

class ListOrdersTool extends FutuurBaseTool<ListOrdersInput> {
  name = "list_orders";
  description = `
    List the authenticated user's limit orders with optional filters.

    Common use cases:
    - When the user wants to see their open or historical orders.
    - When checking the status of a previously placed order.
    - When the user asks "What orders do I have open?" or "Show my recent orders."

    Warning: Returns only the current user's orders; cannot fetch another user's orders.
    Warning: Without filters this may return a large result set.
  `;

  schema = {
    categories: {
      type: z.array(z.number()).optional(),
      description: "Filter by category IDs",
    },
    currencies: {
      type: z.array(z.string()).optional(),
      description: "Filter by currency codes (e.g., ['OOM', 'USDC'])",
    },
    currency: {
      type: z.string().optional(),
      description: "Filter by a single currency code",
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money"]).optional(),
      description: "Filter by currency mode",
    },
    event: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "Filter by event ID",
    },
    limit: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "Number of results to return per page",
    },
    market: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "Filter by market ID",
    },
    offset: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "Pagination offset",
    },
    ordering: {
      type: z.string().optional(),
      description: "Field to order results by",
    },
    search: {
      type: z.string().optional(),
      description: "Search query string",
    },
    side: {
      type: z.enum(["bid", "ask"]).optional(),
      description: "'bid' for buy orders, 'ask' for sell orders",
    },
    status: {
      type: z
        .enum(["open", "partial_filled", "filled", "canceled", "processing"])
        .optional(),
      description: "Filter by order status",
    },
  } as any;

  async execute(input: ListOrdersInput) {
    try {
      const params: Record<string, any> = {};
      if (input.categories?.length) {
        params.categories = input.categories;
      }
      if (input.currencies?.length) {
        params.currencies = input.currencies;
      }
      if (input.currency !== undefined) params.currency = input.currency;
      if (input.currency_mode !== undefined) params.currency_mode = input.currency_mode;
      if (input.event !== undefined) params.event = input.event;
      if (input.limit !== undefined) params.limit = input.limit;
      if (input.market !== undefined) params.market = input.market;
      if (input.offset !== undefined) params.offset = input.offset;
      if (input.ordering !== undefined) params.ordering = input.ordering;
      if (input.search !== undefined) params.search = input.search;
      if (input.side !== undefined) params.side = input.side;
      if (input.status !== undefined) params.status = input.status;

      const data = await fetchFromFutuur("orders/", { params });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error listing orders: ${String(error)}` },
        ],
      };
    }
  }
}

export default ListOrdersTool;
