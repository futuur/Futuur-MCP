import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface CategoriesInput {
  // No input parameters needed for this tool
}

class CategoriesTool extends MCPTool<CategoriesInput> {
  name = "get_categories";
  description = `
    Get available categories in Futuur
    Categories are used to categorize bets in Futuur

    Retrieve all available market categories from Futuur for organizing and filtering prediction markets.

    Common use cases:
    - When the user wants to browse all available market categories.
    - When filtering or organizing markets by category.
    - When building a UI dropdown or filter for categories.
    - When the user asks "What categories are available?"

    Warning: This tool only lists all categories; it does not provide details or subcategories for a specific category.
    Warning: Do not use this tool to retrieve information about a single category—use get_category_details instead.
    Warning: The result may be large if there are many categories.
  `;

  schema = {};

  async execute() {
    try {
      const response = await fetch("https://api.futuur.com/api/v1/categories");

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching categories: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default CategoriesTool;
