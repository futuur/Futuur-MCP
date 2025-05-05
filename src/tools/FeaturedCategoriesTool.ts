import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface FeaturedCategoriesInput {
  // No input parameters needed for this tool
}

class FeaturedCategoriesTool extends MCPTool<FeaturedCategoriesInput> {
  name = "get_featured_categories";
  description = "Get featured categories";

  schema = {
    // No schema needed as this tool doesn't take any input
  };

  async execute() {
    try {
      const response = await fetch("https://api.futuur.com/api/v1/categories/featured/");
      
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
          text: `Error fetching featured categories: ${String(error)}`
        }]
      };
    }
  }
}

export default FeaturedCategoriesTool;