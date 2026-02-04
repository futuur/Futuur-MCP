import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface MarketDetailsInput {
  id: number;
}

class MarketDetailsTool extends MCPTool<MarketDetailsInput> {
  name = "get_market_details";
  description = `
    Retrieve detailed information about a specific event (which contains markets) by its ID.

    Common use cases:
    - When the user wants detailed information about a specific event.
    - When displaying an event's details in a UI.
    - When the user asks "Show me the details for event X."

    Warning: You must provide a valid event ID; otherwise, the tool will fail.
    Warning: This tool does not list all events—use get_markets for that.
    Warning: If the event ID does not exist, the tool will return an error.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "A unique integer value identifying this event"
    }
  } as any;

  async execute(input: MarketDetailsInput) {
    try {
      // v2.0 API: Use /events/{id}/ endpoint (markets are nested in events)
      const response = await fetch(`https://api.futuur.com/events/${input.id}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MyServerBot/1.0; +https://example.com)"
        }
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
          text: `Error fetching event details: ${String(error)}`
        }]
      };
    }
  }
}

export default MarketDetailsTool;