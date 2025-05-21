import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface CategoryByIdInput {
  id: number;
}

class CategoryByIdTool extends MCPTool<CategoryByIdInput> {
  name = "get_category_details";
  description = `
    Retrieve details and subcategories for a specific category by its ID

    Common use cases:
    - When the user wants to see details or subcategories for a specific category.
    - When building a category navigation or hierarchy.
    - When the user asks "What's inside category X?" or "Show me subcategories of Y."

    Warning: You must provide a valid category ID; otherwise, the tool will fail.
    Warning: This tool does not list all categories—use list_categories for that.
    Warning: If the category ID does not exist, the tool will return an error.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number()
      ),
      description: "A unique integer value identifying this category"
    }
  } as any;

  async execute(input: CategoryByIdInput) {
    try {
      const response = await fetch(`https://api.futuur.com/api/v1/categories/${input.id}/`, {
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
          text: `Error fetching category with ID ${input.id}: ${String(error)}`
        }]
      };
    }
  }
}

export default CategoryByIdTool;