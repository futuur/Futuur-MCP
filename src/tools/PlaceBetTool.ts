import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur, simulateBetPurchase } from "../utils/api.js";

interface PlaceBetInput {
  outcome: number;
  amount?: number;
  shares?: number;
  currency?: string;
  position?: "l" | "s";
  fiat_equivalent_mode?: boolean;
  bet_location?: string;
  outcomes_type?: "yesno" | "custom";
}

class PlaceBetTool extends MCPTool<PlaceBetInput> {
  name = "place_bet";
  description = `
    Place a bet on a specific market outcome, specifying amount, shares, currency, and position, and receive confirmation of the bet placement.

    Common use cases:
    - When the user has reviewed a simulation and confirmed they want to place a bet.
    - When executing a bet after previewing the outcome and cost.
    - When the user says "Yes, place the bet" after seeing a simulation.

    Warning: This tool executes a real bet; ensure you have simulated and confirmed before using.
    Warning: Once executed, bets cannot be undone or reversed.
    Warning: Incomplete or invalid parameters (e.g., missing amount or shares) will cause the tool to fail.
  `;

  schema = {
    outcome: {
      type: z.number(),
      description: "ID of the outcome to bet on"
    },
    amount: {
      type: z.number().positive().optional(),
      description: "Amount to bet (must be positive)"
    },
    shares: {
      type: z.number().optional(),
      description: "Number of shares to purchase"
    },
    currency: {
      type: z.string().max(11).default("OOM"),
      description: "Currency to use for the bet"
    },
    position: {
      type: z.enum(["l", "s"]).default("l"),
      description: "Position type: 'l' for long (bet in favor) or 's' for short (bet against)"
    },
    fiat_equivalent_mode: {
      type: z.boolean().default(false).optional(),
      description: "Whether to use fiat equivalent mode"
    },
    bet_location: {
      type: z.string().default("MCP").optional(),
      description: "Location where the bet was placed"
    },
    outcomes_type: {
      type: z.enum(["yesno", "custom"]).optional(),
      description: "Type of market outcomes"
    }
  };

  async execute(input: PlaceBetInput) {
    try {
      // At least one of amount or shares must be provided
      if (input.amount === undefined && input.shares === undefined) {
        throw new Error("Either amount or shares must be provided");
      }

      // Validate amount is positive
      if (input.amount !== undefined && input.amount <= 0) {
        throw new Error("Amount must be positive");
      }

      // For yes/no markets, position must be 'l'
      if (input.outcomes_type === "yesno" && input.position !== "l") {
        throw new Error("Position must be 'l' (long) for yes/no markets");
      }

      // Always use simulation to get the exact purchase parameters
      const simulationResult = await simulateBetPurchase(
        input.outcome,
        input.amount,
        input.currency,
        input.position
      );

      // Use the simulation result as the request body
      const requestBody = simulationResult;

      const data = await fetchFromFutuur("bets/", {
        method: "POST",
        body: requestBody,
        useHmac: true,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error placing bet: ${String(error)}`,
          },
        ],
      };
    }
  }
}

export default PlaceBetTool;