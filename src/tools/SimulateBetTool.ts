import { z } from "zod";
import { simulateBetPurchase, SimulateBetPurchaseParams } from "../utils/api.js";
import { SIMULATION_PAYLOAD_SOURCE_MARKER } from "../utils/toolConstants.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

// Interface for validated & structured input to the execute method
interface SimulateBetExecuteInput {
  outcome: number;
  currency: string; // Zod will ensure default
  position: "l" | "s"; // Zod will ensure default
  amount?: number;
  shares?: number;
}

class SimulateBetTool extends FutuurBaseTool<SimulateBetExecuteInput> {
  name = "get_bet_simulation";
  description = `
Simulates a bet purchase on a specific market outcome without actually placing the bet.
This tool calls the GET /api/v1/bets/simulate_purchase/ Futuur API endpoint.
It helps preview the potential cost if specifying shares, or the potential shares if specifying an amount.
This tool should be called first to get a preview and the exact payload for the 'place_bet' tool.

Use cases:
- Previewing bet details: "How many shares of outcome X can I get for 100 OOM?"
- Previewing bet costs: "What is the cost for 50 shares of outcome Y?"
- Getting the necessary payload for the 'place_bet' tool after user confirmation.

Parameters:
- outcome (number, required): The ID of the market outcome to simulate a bet on.
- currency (string, optional, default: 'OOM'): The currency for the simulation (e.g., 'OOM', 'USD', 'BTC').
- position (string, optional, default: 'l'): The position of the bet ('l' for long/in-favor, 's' for short/against).
- amount (number, optional): The monetary amount you want to simulate spending. Provide this OR 'shares'.
- shares (number, optional): The number of shares you want to simulate purchasing. Provide this OR 'amount'.

Warning: This tool ONLY simulates a bet; it does NOT place an actual bet. 
Warning: Always use this tool to preview the bet and obtain the simulation payload before calling 'place_bet'.
Warning: You must provide either 'amount' or 'shares'. If neither or both are provided, the tool will return an error.
The API will determine the missing value (amount or shares) based on the one provided.
  `;

  schema = {
    outcome: {
      type: z.preprocess(
        (val: unknown) => (typeof val === 'string' ? parseInt(val, 10) : val),
        z.number({ required_error: "Outcome ID (outcome) is required." })
      ),
      description: "ID of the market outcome to simulate a bet on."
    },
    currency: {
      type: z.string().max(11).default("OOM"),
      description: "Currency for the simulation (e.g., 'OOM', 'USD')."
    },
    position: {
      type: z.enum(["l", "s"]).default("l"),
      description: "Bet position: 'l' for long (in favor), 's' for short (against)."
    },
    amount: {
      type: z.number().positive().optional(),
      description: "Monetary amount to simulate spending. Provide this OR shares."
    },
    shares: {
      type: z.number().positive().optional(),
      description: "Number of shares to simulate purchasing. Provide this OR amount."
    }
  } as any;

  async execute(input: SimulateBetExecuteInput) {
    try {
      // Custom validation: ensure either amount or shares is provided, but not both
      const amountProvided = input.amount !== undefined;
      const sharesProvided = input.shares !== undefined;

      if (!amountProvided && !sharesProvided) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Either 'amount' or 'shares' must be provided for the simulation."
          }]
        };
      }

      if (amountProvided && sharesProvided) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Please provide either 'amount' or 'shares' for the simulation, not both."
          }]
        };
      }

      const apiParams: SimulateBetPurchaseParams = {
        outcome: input.outcome,
        currency: input.currency,
        position: input.position,
      };

      if (input.amount !== undefined) {
        apiParams.amount = input.amount;
      } else if (input.shares !== undefined) {
        apiParams.shares = input.shares;
      }

      const simulationData = await simulateBetPurchase(apiParams);

      // Add a source marker to ensure this output is used by PlaceBetTool
      const markedSimulationData = {
        ...simulationData,
        tool_source: SIMULATION_PAYLOAD_SOURCE_MARKER,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(markedSimulationData, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error simulating bet purchase: ${errorMessage}`,
          },
        ],
      };
    }
  }
}

export default SimulateBetTool; 