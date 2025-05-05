import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface SuggestMarketInput {
  title: string;
  description: string;
  category?: string;
  end_bet_date?: string;
  outcomes: Array<{
    title: string;
    price: number;
    description?: string;
  }>;
}

class SuggestMarketTool extends MCPTool<SuggestMarketInput> {
  name = "suggest_market";
  description = "Suggest a new market";

  schema = {
    title: {
      type: z.string().min(1).max(150),
      description: "Title of the market"
    },
    description: {
      type: z.string().min(1).max(800),
      description: "Description of the market"
    },
    category: {
      type: z.string().min(1).max(75).optional(),
      description: "Category of the market"
    },
    end_bet_date: {
      type: z.string().optional(),
      description: "End date for betting in format YYYY-MM-DDTHH:MM:SSZ"
    },
    outcomes: {
      type: z.array(
        z.object({
          title: z.string(),
          price: z.number().min(0).max(100),
          description: z.string().optional()
        })
      ).min(2),
      description: "Possible outcomes for the market (prices should add up to 100)"
    }
  };

  async execute(input: SuggestMarketInput) {
    try {
      // Validate that outcome prices sum to 100
      const priceSum = input.outcomes.reduce((sum, outcome) => sum + outcome.price, 0);
      if (Math.abs(priceSum - 100) > 0.01) {
        throw new Error(`Outcome prices must sum to 100, but they sum to ${priceSum}`);
      }
      
      const response = await fetch("https://api.futuur.com/api/v1/markets/suggest_market/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
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
}

export default SuggestMarketTool;