import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface MarketDetailsInput {
  id: number;
}

class MarketDetailsTool extends MCPTool<MarketDetailsInput> {
  name = "get_market_details";
  description = `
    Retrieve detailed information about a specific market by its ID.

    Common use cases:
    - When the user wants detailed information about a specific market.
    - When displaying a market's details in a UI.
    - When the user asks "Show me the details for market X."

    Warning: You must provide a valid market ID; otherwise, the tool will fail.
    Warning: This tool does not list all markets—use list_markets for that.
    Warning: If the market ID does not exist, the tool will return an error.
  `;

  schema = {
    id: {
      type: z.number(),
      description: "A unique integer value identifying this market"
    }
  };

  async execute(input: MarketDetailsInput) {
    try {
      const response = await fetch(`https://api.futuur.com/api/v1/markets/${input.id}`);
      
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
}

export default MarketDetailsTool;