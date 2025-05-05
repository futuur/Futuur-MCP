import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface RelatedMarketsInput {
  id: number;
}

class RelatedMarketsTool extends MCPTool<RelatedMarketsInput> {
  name = "get_related_markets";
  description = "Get related markets for a specific market";

  schema = {
    id: {
      type: z.number(),
      description: "A unique integer value identifying this market"
    }
  };

  async execute(input: RelatedMarketsInput) {
    try {
      const response = await fetch(`https://api.futuur.com/api/v1/markets/${input.id}/related_markets/`);
      
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
}

export default RelatedMarketsTool;