import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface CategoriesInput {
  // No input parameters needed for this tool
}

class CategoriesTool extends MCPTool<CategoriesInput> {
  name = "get_categories";
  description = "Get all categories";

  schema = {
    // No schema needed as this tool doesn't take any input
  };

  async execute() {
    try {
      const response = await fetch("https://api.futuur.com/api/v1/categories");
      
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
          text: `Error fetching categories: ${String(error)}`
        }]
      };
    }
  }
}

export default CategoriesTool;