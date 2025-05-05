import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface RootCategoriesMainChildrenInput {
  currency_mode: "play_money" | "real_money";
  search?: string;
}

class RootCategoriesMainChildrenTool extends MCPTool<RootCategoriesMainChildrenInput> {
  name = "get_root_categories_and_main_children";
  description = "Get root categories and their main children";

  schema = {
    currency_mode: {
      type: z.enum(["play_money", "real_money"]),
      description: "Currency mode: play_money or real_money"
    },
    search: {
      type: z.string().optional(),
      description: "Optional search term to filter categories"
    }
  };

  async execute(input: RootCategoriesMainChildrenInput) {
    try {
      const queryParams = new URLSearchParams({
        currency_mode: input.currency_mode
      });
      
      if (input.search) {
        queryParams.append("search", input.search);
      }
      
      const response = await fetch(
        `https://api.futuur.com/api/v1/categories/root_and_main_children/?${queryParams}`
      );
      
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
          text: `Error fetching root categories and main children: ${String(error)}`
        }]
      };
    }
  }
}

export default RootCategoriesMainChildrenTool;