import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface GetExchangeRatesInput {
  message: string;
}

class GetExchangeRatesTool extends MCPTool<GetExchangeRatesInput> {
  name = "get-exchange-rates";
  description = "GetExchangeRates tool description";

  schema = {
    message: {
      type: z.string(),
      description: "Message to process",
    },
  };

  async execute(input: GetExchangeRatesInput) {
    return `Processed: ${input.message}`;
  }
}

export default GetExchangeRatesTool;