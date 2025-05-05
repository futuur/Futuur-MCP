import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface BetsInput {
  message: string;
}

class BetsTool extends MCPTool<BetsInput> {
  name = "bets";
  description = "Bets tool description";

  schema = {
    message: {
      type: z.string(),
      description: "Message to process",
    },
  };

  async execute(input: BetsInput) {
    return `Processed: ${input.message}`;
  }
}

export default BetsTool;