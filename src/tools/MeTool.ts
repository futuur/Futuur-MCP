import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface MeInput {
  // No input parameters needed for this tool
}

class MeTool extends FutuurBaseTool<MeInput> {
  name = "get_user_profile";
  description = `
    Retrieve the profile information of the user.

    Common use cases:
    - When the user wants to see their profile or account information.
    - When displaying user details in a dashboard or settings page.
    - When the user asks "What's my profile info?" or "Show my account details."

    Warning: This tool only retrieves the profile of the currently authenticated user.
    Warning: It cannot be used to update or change profile information.
    Warning: If the user is not authenticated, the tool will return an error.
  `;

  schema = {};

  async execute() {
    try {
      const data = await fetchFromFutuur("me");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching user profile: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default MeTool;
