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
    Retrieve and list markets from Futuur, with optional filters such as category, status, and search query, to help you find relevant prediction markets. By default, it will show play money and real money odds (outcomes prices).

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
      type: z.preprocess((val) => {
        // Handle empty string
        if (val === "" || val === null || val === undefined) {
          return undefined;
        }

        // Handle already parsed arrays
        if (Array.isArray(val)) {
          return val.map((v) => (typeof v === "string" ? parseInt(v, 10) : v));
        }

        // Handle string inputs
        if (typeof val === "string") {
          // Handle JSON array string like "[11,22,14]"
          if (val.trim().startsWith("[") && val.trim().endsWith("]")) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) {
                return parsed.map((v) =>
                  typeof v === "string" ? parseInt(v, 10) : v
                );
              }
            } catch (e) {
              // If JSON parsing fails, fall through to other handling
            }
          }

          // Handle comma-separated string like "11,22,14"
          if (val.includes(",")) {
            return val
              .split(",")
              .map((v) => parseInt(v.trim(), 10))
              .filter((n) => !isNaN(n));
          }

          // Handle single number string
          const singleNum = parseInt(val.trim(), 10);
          if (!isNaN(singleNum)) {
            return [singleNum];
          }
        }

        return val;
      }, z.array(z.number()).optional()),
      description: "Array of category IDs to filter markets",
    },
    currency_mode: {
      type: z.enum(["play_money", "real_money", "all"]).default("all"),
      description:
        "Currency mode. Allowed values: 'play_money', 'real_money', or 'all' to fetch both.",
    },
    hide_my_bets: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? val === "true" : val),
        z.boolean().default(false)
      ),
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
      type: z.preprocess(
        (val) => (typeof val === "string" ? val === "true" : val),
        z.boolean().default(false)
      ),
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
      type: z.preprocess(
        (val) => (typeof val === "string" ? val === "true" : val),
        z.boolean().default(false)
      ),
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
      type: z.preprocess(
        (val) => (typeof val === "string" ? val === "true" : val),
        z.boolean().default(false)
      ),
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
      type: z.enum(["open", "closed", "resolved", ""]).optional(),
      description:
        "Filter markets by status. Only the following values are allowed: 'open', 'closed', 'resolved', or '' (empty string) for no status filter.",
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
          `API request failed for currencyMode '${
            currencyMode || "default"
          }' with status ${response.status}: ${errorText}`
        );
      }
      return response.json();
    };

    const formatMarketData = (marketData: any) => {
      const formatCurrency = (amount: number, currency: string = "USD") => {
        if (currency === "OOM") {
          return `ø${amount.toLocaleString()}`;
        } else {
          return `$${amount.toLocaleString()}`;
        }
      };

      const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      };

      let formattedOutput = `# Futuur Prediction Markets\n\n`;

      if (marketData.results && marketData.results.length > 0) {
        formattedOutput += `Found ${marketData.results.length} market(s)\n\n`;

        marketData.results.forEach((market: any, index: number) => {
          formattedOutput += `## ${index + 1}. ${market.title}\n\n`;

          // Market status and basic info
          formattedOutput += `**Status:** ${market.status_display}\n`;
          if (market.bet_end_date) {
            formattedOutput += `**Betting ends:** ${formatDate(
              market.bet_end_date
            )}\n`;
          }

          // Categories
          if (market.category && market.category.length > 0) {
            const categoryPath = market.category
              .map((cat: any) => cat.title)
              .join(" > ");
            formattedOutput += `**Category:** ${categoryPath}\n`;
          }

          // Tags
          if (market.tags && market.tags.length > 0) {
            const tagNames = market.tags.map((tag: any) => tag.name).join(", ");
            formattedOutput += `**Tags:** ${tagNames}\n`;
          }

          formattedOutput += `\n`;

          // Trading volume
          if (market.volume_play_money || market.volume_real_money) {
            formattedOutput += `**Trading Volume:**\n`;
            if (market.volume_play_money) {
              formattedOutput += `- Play Money: ${formatCurrency(
                market.volume_play_money,
                "OOM"
              )}\n`;
            }
            if (market.volume_real_money) {
              formattedOutput += `- Real Money: ${formatCurrency(
                market.volume_real_money,
                market.canonical_currency
              )}\n`;
            }
            formattedOutput += `\n`;
          }

          // Outcomes and odds
          if (market.outcomes && market.outcomes.length > 0) {
            formattedOutput += `**Current Odds:**\n`;
            market.outcomes.forEach((outcome: any) => {
              formattedOutput += `- **${outcome.title}:**\n`;
              if (outcome.price) {
                if (outcome.price.OOM) {
                  formattedOutput += `  - Play Money: ${(
                    outcome.price.OOM * 100
                  ).toFixed(1)}% (${formatCurrency(
                    outcome.price.OOM,
                    "OOM"
                  )})\n`;
                }
                if (outcome.price.BTC) {
                  formattedOutput += `  - Real Money: ${(
                    outcome.price.BTC * 100
                  ).toFixed(1)}% (${formatCurrency(
                    outcome.price.BTC,
                    "BTC"
                  )})\n`;
                }
                // Handle other currencies dynamically
                Object.keys(outcome.price).forEach((currency) => {
                  if (currency !== "OOM" && currency !== "BTC") {
                    formattedOutput += `  - Real Money (${currency}): ${(
                      outcome.price[currency] * 100
                    ).toFixed(1)}% (${formatCurrency(
                      outcome.price[currency],
                      currency
                    )})\n`;
                  }
                });
              }
            });
            formattedOutput += `\n`;
          }

          // Description (truncated if too long)
          if (market.description) {
            const plainDescription = market.description
              .replace(/<[^>]*>/g, "")
              .trim();
            const truncatedDesc =
              plainDescription.length > 200
                ? plainDescription.substring(0, 200) + "..."
                : plainDescription;
            formattedOutput += `**Description:** ${truncatedDesc}\n\n`;
          }

          formattedOutput += `**Market ID:** ${market.id}\n\n`;

          if (index < marketData.results.length - 1) {
            formattedOutput += `---\n\n`;
          }
        });

        // Pagination info
        if (marketData.pagination) {
          formattedOutput += `\n## Pagination Info\n`;
          if (marketData.pagination.total) {
            formattedOutput += `Total markets available: ${marketData.pagination.total}\n`;
          }
          if (marketData.pagination.note) {
            formattedOutput += `Note: ${marketData.pagination.note}\n`;
          }
        }
      } else {
        formattedOutput += `No markets found matching your criteria.\n`;
      }

      return formattedOutput;
    };

    try {
      let allMarketData: any = { results: [], pagination: {} }; // Initialize with empty results and placeholder pagination

      if (input.currency_mode === "all") {
        const playMoneyData = await fetchMarkets("play_money");

        allMarketData.results = playMoneyData.results;
        allMarketData.custom_formatted_response =
          formatMarketData(playMoneyData);

        // For pagination, we could try to merge or indicate it's a combined list.
        // A simple approach is to use pagination from the first call or a summary.
        // For now, let's just take play_money's pagination as a representative, or sum totals.
        // Summing total results if available in pagination
        const totalPlay = playMoneyData.pagination?.total || 0;
        allMarketData.pagination = {
          ...playMoneyData.pagination, // take structure from one of them
          // next/previous might not be meaningful for combined results without more complex logic
          next: null,
          previous: null,
          note: "Pagination for combined results; next/previous links are invalidated.",
        };
      } else if (
        input.currency_mode === "play_money" ||
        input.currency_mode === "real_money"
      ) {
        allMarketData = await fetchMarkets(input.currency_mode);
        allMarketData.custom_formatted_response =
          formatMarketData(allMarketData);
      } else {
        // This case should ideally not be reached if default is 'all' and schema is enforced.
        // But as a fallback, or if currency_mode is somehow undefined post-validation.
        allMarketData = await fetchMarkets("play_money"); // Default to play_money if something went wrong
        allMarketData.custom_formatted_response =
          formatMarketData(allMarketData);
      }

      return {
        content: [
          {
            type: "text",
            text: allMarketData,
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
