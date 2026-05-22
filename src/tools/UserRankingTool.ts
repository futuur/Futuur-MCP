import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface UserRankingInput {
  // No parameters needed
}

class UserRankingTool extends FutuurBaseTool<UserRankingInput> {
  name = "get_user_ranking";
  description = `
    Retrieve the leaderboard ranking of the authenticated user.

    Common use cases:
    - When the user wants to know their ranking on the Futuur leaderboard.
    - When the user asks "What's my ranking?" or "Where do I stand on the leaderboard?"

    Warning: Returns only the ranking of the currently authenticated user.
  `;

  schema = {};

  async execute() {
    try {
      const data = await fetchFromFutuur("me/ranking/");

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error fetching user ranking: ${String(error)}` },
        ],
      };
    }
  }
}

export default UserRankingTool;
