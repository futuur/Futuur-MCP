import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMarketTools(server: McpServer) {
  // Tool to get markets with optional filtering
  server.tool(
    "get_markets", 
    { 
      categories: z.array(z.number()).optional().describe("Array of category IDs to filter markets"),
      currency_mode: z.enum(["play_money", "real_money"]).default("play_money").describe("Currency mode: play_money or real_money"),
      hide_my_bets: z.boolean().default(false).describe("Whether to hide markets the user has bet on"),
      limit: z.number().optional().describe("Number of results to return per page"),
      live: z.boolean().default(false).describe("Filter for live markets only"),
      offset: z.number().optional().describe("The initial index from which to return the results"),
      only_markets_i_follow: z.boolean().default(false).describe("Filter for markets the user follows"),
      ordering: z.enum(["", "relevance", "-created_on", "bet_end_date", "-wagers_count", "-volume"]).default("").describe("Field to order results by"),
      resolved_only: z.boolean().default(false).describe("Filter for resolved markets only"),
      search: z.string().min(1).max(100).optional().describe("Search query string"),
      tag: z.string().min(1).max(100).optional().describe("Filter markets by tag"),
      status: z.enum(["open", "closed", "resolved"]).optional().describe("Filter markets by status"),
    }, 
    async (params) => {
      try {
        // Build query parameters
        const queryParams = new URLSearchParams();
        
        if (params.categories !== undefined && params.categories.length > 0) {
          params.categories.forEach(category => 
            queryParams.append("categories", category.toString())
          );
        }
        if (params.currency_mode) queryParams.append("currency_mode", params.currency_mode);
        if (params.hide_my_bets !== undefined) queryParams.append("hide_my_bets", params.hide_my_bets.toString());
        if (params.limit !== undefined) queryParams.append("limit", params.limit.toString());
        if (params.live !== undefined) queryParams.append("live", params.live.toString());
        if (params.offset !== undefined) queryParams.append("offset", params.offset.toString());
        if (params.only_markets_i_follow !== undefined) queryParams.append("only_markets_i_follow", params.only_markets_i_follow.toString());
        if (params.ordering) queryParams.append("ordering", params.ordering);
        if (params.resolved_only !== undefined) queryParams.append("resolved_only", params.resolved_only.toString());
        if (params.search) queryParams.append("search", params.search);
        if (params.tag) queryParams.append("tag", params.tag);
        if (params.status !== undefined) queryParams.append("status", params.status);
        
        const url = `https://api.futuur.com/api/v1/markets?${queryParams.toString()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(data, null, 2) 
          }] 
        };
      } catch (error) {
        return { 
          content: [{ 
            type: "text", 
            text: `Error fetching markets: ${String(error)}` 
          }] 
        };
      }
    }
  );

  // Tool to get market details by ID
  server.tool(
    "get_market_details",
    {
      id: z.number().describe("A unique integer value identifying this market")
    },
    async ({ id }) => {
      try {
        const response = await fetch(`https://api.futuur.com/api/v1/markets/${id}`);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching market details: ${String(error)}`
          }]
        };
      }
    }
  );
 
  // Tool to get related markets
  server.tool(
    "get_related_markets",
    {
      id: z.number().describe("A unique integer value identifying this market")
    },
    async ({ id }) => {
      try {
        const response = await fetch(`https://api.futuur.com/api/v1/markets/${id}/related_markets/`);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching related markets: ${String(error)}`
          }]
        };
      }
    }
  );

  // Tool to suggest a new market
  server.tool(
    "suggest_market",
    {
      title: z.string().min(1).max(150).describe("Title of the market"),
      description: z.string().min(1).max(800).describe("Description of the market"),
      category: z.string().min(1).max(75).optional().describe("Category of the market"),
      end_bet_date: z.string().optional().describe("End date for betting in format YYYY-MM-DDTHH:MM:SSZ"),
      outcomes: z.array(
        z.object({
          title: z.string().describe("Title of the outcome"),
          price: z.number().min(0).max(100).describe("Price of the outcome (0-100, all prices should add up to 100)"),
          description: z.string().optional().describe("Description of the outcome")
        })
      ).min(2).describe("Possible outcomes for the market (prices should add up to 100)")
    },
    async (params) => {
      try {
        // Validate that outcome prices sum to 100
        const priceSum = params.outcomes.reduce((sum, outcome) => sum + outcome.price, 0);
        if (Math.abs(priceSum - 100) > 0.01) {
          throw new Error(`Outcome prices must sum to 100, but they sum to ${priceSum}`);
        }
        
        const response = await fetch("https://api.futuur.com/api/v1/markets/suggest_market/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(params)
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error suggesting market: ${String(error)}`
          }]
        };
      }
    }
  );
} 