import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface ExchangeRatesInput {
  message: string;
}

class ExchangeRatesTool extends MCPTool<ExchangeRatesInput> {
  name = "exchange-rates";
  description = "ExchangeRates tool description";

  schema = {
    message: {
      type: z.string(),
      description: "Message to process",
    },
  };

  async execute(input: ExchangeRatesInput) {
    return `Processed: ${input.message}`;
  }
}

export default ExchangeRatesTool;