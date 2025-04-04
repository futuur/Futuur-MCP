
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchFromFutuur } from "../utils/api.js";

export function registerUserTools(server: McpServer) {
  // Tool to get user profile information
  server.tool(
    "get_user_profile",
    {
      // Removed token parameter
    },
    async () => {
      try {
        const data = await fetchFromFutuur("me", {});
        
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
            text: `Error fetching user profile: ${String(error)}`
          }]
        };
      }
    }
  );
}
