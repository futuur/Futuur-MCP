import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";

interface MeInput {
  // No input parameters needed for this tool
}

class MeTool extends MCPTool<MeInput> {
  name = "get_user_profile";
  description = "Get user profile information";

  schema = {
    // No schema needed as this tool doesn't take any input
  };

  async execute() {
    try {
      const data = await fetchFromFutuur("me", {});
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Error fetching user profile: ${String(error)}`
        }]
      };
    }
  }
}

export default MeTool;