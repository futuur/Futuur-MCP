import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface MarketsInput {
  categories?: number[];
  currency_mode?: "play_money" | "real_money" | "all";
  hide_my_bets?: boolean;
  limit?: number;
  live?: boolean;
  offset?: number;
  only_markets_i_follow?: boolean;
  ordering?:
    | ""
    | "relevance"
    | "-created_on"
    | "bet_end_date"
    | "-wagers_count"
    | "-volume";
  resolved_only?: boolean;
  search?: string;
  tag?: string;
  status?: "open" | "closed" | "resolved";
}

class MarketsTool extends MCPTool<MarketsInput> {
  name = "get_markets";
  description = `
    Retrieve and list markets from Futuur, with optional filters such as category, status, and search query, to help you find relevant prediction markets.

    Common use cases:
    - When the user wants to browse or search for markets.
    - When filtering markets by category, status, or search query.
    - When building a market listing or search feature.
    - When the user asks "What markets are available?" or "Show me open markets in category X or get me the top 10 markets by volume or fetch me the top 5 markets in crypto"

    Warning: If no filters are provided, the result may be very large.
    Warning: This tool does not provide detailed information for a single market—use get_market_by_id for that.
    Warning: Using too many filters may result in no markets being returned.
  `;

  schema = {
    categories: {
      type: z.preprocess(
        (val) =>
          Array.isArray(val)
            ? val.map((v) => (typeof v === "string" ? parseInt(v, 10) : v))
            : val,
        z.array(z.number()).optional()
      ),
      description: "Array of category IDs to filter markets",
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money", "all"]).default("all"),
      description:
        "Currency mode. Allowed values: 'play_money', 'real_money', or 'all' to fetch both.",
    },
    hide_my_bets: {
      type: z.boolean().default(false),
      description: "Whether to hide markets the user has bet on",
    },
    limit: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "Number of results to return per page",
    },
    live: {
      type: z.boolean().default(false),
      description: "Filter for live markets only",
    },
    offset: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number().optional()
      ),
      description: "The initial index from which to return the results",
    },
    only_markets_i_follow: {
      type: z.boolean().default(false),
      description:
        "Filter for markets the user follows, this IF true requires a user to be logged in, use the meTool to check if a user is logged in",
    },
    ordering: {
      type: z
        .enum([
          "",
          "relevance",
          "-created_on",
          "bet_end_date",
          "-wagers_count",
          "-volume",
        ])
        .default(""),
      description:
        "Field to order results by. Only the following values are allowed: '', 'relevance', '-created_on', 'bet_end_date', '-wagers_count', '-volume'. Use '-volume' for ordering by volume. There is no '-real-volume' option.",
    },
    resolved_only: {
      type: z.boolean().default(false),
      description: "Filter for resolved markets only",
    },
    search: {
      type: z.string().min(1).max(100).optional(),
      description: "Search query string",
    },
    tag: {
      type: z.string().min(1).max(100).optional(),
      description: "Filter markets by tag",
    },
    status: {
      type: z.enum(["open", "closed", "resolved"]).optional(),
      description:
        "Filter markets by status. Only the following values are allowed: 'open', 'closed', 'resolved'.",
    },
  } as any;

  async execute(input: MarketsInput) {
    const fetchMarkets = async (currencyMode?: "play_money" | "real_money") => {
      const queryParams = new URLSearchParams();

      if (input.categories !== undefined && input.categories.length > 0) {
        input.categories.forEach((category) =>
          queryParams.append("categories", category.toString())
        );
      }
      if (currencyMode) {
        queryParams.append("currency_mode", currencyMode);
      }
      if (input.hide_my_bets !== undefined) {
        queryParams.append("hide_my_bets", input.hide_my_bets.toString());
      }
      if (input.limit !== undefined) {
        queryParams.append("limit", input.limit.toString());
      }
      if (input.live !== undefined) {
        queryParams.append("live", input.live.toString());
      }
      if (input.offset !== undefined) {
        queryParams.append("offset", input.offset.toString());
      }
      if (input.only_markets_i_follow !== undefined) {
        queryParams.append(
          "only_markets_i_follow",
          input.only_markets_i_follow.toString()
        );
      }
      if (input.ordering) {
        queryParams.append("ordering", input.ordering);
      }
      if (input.resolved_only !== undefined) {
        queryParams.append("resolved_only", input.resolved_only.toString());
      }
      if (input.search) {
        queryParams.append("search", input.search);
      }
      if (input.tag) {
        queryParams.append("tag", input.tag);
      }
      if (input.status !== undefined) {
        queryParams.append("status", input.status);
      }

      const url = `https://api.futuur.com/api/v1/markets?${queryParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MyServerBot/1.0; +https://example.com)",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed for currencyMode '${currencyMode || "default"}' with status ${response.status}: ${errorText}`
        );
      }
      return response.json();
    };

    try {
      let allMarketData: any = { results: [], pagination: {} }; // Initialize with empty results and placeholder pagination

      if (input.currency_mode === "all") {
        const playMoneyData = await fetchMarkets("play_money");
        const realMoneyData = await fetchMarkets("real_money");
        
        allMarketData.results = [
          ...(playMoneyData.results || []),
          ...(realMoneyData.results || []),
        ];
        // For pagination, we could try to merge or indicate it's a combined list.
        // A simple approach is to use pagination from the first call or a summary.
        // For now, let's just take play_money's pagination as a representative, or sum totals.
        // Summing total results if available in pagination
        const totalPlay = playMoneyData.pagination?.total || 0;
        const totalReal = realMoneyData.pagination?.total || 0;
        allMarketData.pagination = {
            ...playMoneyData.pagination, // take structure from one of them
            total: totalPlay + totalReal, // sum totals
            // next/previous might not be meaningful for combined results without more complex logic
            next: null,
            previous: null,
            note: "Pagination for combined results; next/previous links are invalidated."
        };

      } else if (input.currency_mode === "play_money" || input.currency_mode === "real_money") {
        allMarketData = await fetchMarkets(input.currency_mode);
      } else {
        // This case should ideally not be reached if default is 'all' and schema is enforced.
        // But as a fallback, or if currency_mode is somehow undefined post-validation.
        allMarketData = await fetchMarkets("play_money"); // Default to play_money if something went wrong
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(allMarketData, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching markets: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default MarketsTool;
