import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface CategoryByIdInput {
  id: number;
}

class CategoryByIdTool extends MCPTool<CategoryByIdInput> {
  name = "get_category_by_id";
  description = "Get more subcategories for a specific category";

  schema = {
    id: {
      type: z.number(),
      description: "A unique integer value identifying this category"
    }
  };

  async execute(input: CategoryByIdInput) {
    try {
      const response = await fetch(`https://api.futuur.com/api/v1/categories/${input.id}/`);
      
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
          text: `Error fetching category with ID ${input.id}: ${String(error)}`
        }]
      };
    }
  }
}

export default CategoryByIdTool;