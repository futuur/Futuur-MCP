import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface MarketDetailsInput {
  id: number;
}

class MarketDetailsTool extends MCPTool<MarketDetailsInput> {
  name = "get_market_details";
  description = "Get market details by ID";

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