import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface FormatNumberInput {
  value: number;
  locale?: string;
  min_decimals?: number;
  max_decimals?: number;
}

class FormatNumberTool extends MCPTool<FormatNumberInput> {
  name = "format_number";
  description = "Format a number with locale and decimal places";

  schema = {
    value: {
      type: z.number(),
      description: "Number to format"
    },
    locale: {
      type: z.string().default("en-US"),
      description: "Locale string (e.g. 'en-US')"
    },
    min_decimals: {
      type: z.number().min(0).default(2),
      description: "Minimum decimal places"
    },
    max_decimals: {
      type: z.number().min(0).default(2),
      description: "Maximum decimal places"
    }
  };

  async execute(input: FormatNumberInput) {
    try {
      const formatted = new Intl.NumberFormat(input.locale, {
        minimumFractionDigits: input.min_decimals,
        maximumFractionDigits: input.max_decimals,
      }).format(input.value);

      return {
        content: [
          {
            type: "text",
            text: formatted,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error formatting number: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default FormatNumberTool;