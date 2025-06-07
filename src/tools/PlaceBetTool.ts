import { z } from "zod";
import { placeBet, fetchFromFutuur } from "../utils/api.js";
import { SIMULATION_PAYLOAD_SOURCE_MARKER } from "../utils/toolConstants.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

// Define the structure of the payload expected from the simulation service
// This should match the BetPrice schema from OpenAPI / output of simulateBetPurchase
const ConfirmedSimulationPayloadSchema = z.object({
  outcome: z.number(),
  amount: z.number(), // This is the API resolved amount
  shares: z.number(), // This is the API resolved shares
  currency: z.string(),
  position: z.enum(["l", "s"]),
  tool_source: z.literal(SIMULATION_PAYLOAD_SOURCE_MARKER),
  // Any other fields from simulationData would also be implicitly included here if not explicitly listed,
  // as long as they don't conflict with the defined ones. If simulationData could have many other fields,
  // and we only care about the ones above + tool_source for validation, .passthrough() or explicit listing is better.
  // For now, assuming simulationData mostly contains these core fields.
});

interface PlaceBetExecuteInput {
  confirmed_simulation_payload: Record<string, any>;
  bet_location?: string;
}

class PlaceBetTool extends FutuurBaseTool<PlaceBetExecuteInput> {
  name = "place_bet";
  description = `
    Place a bet on a market using a previously confirmed simulation payload.
    This tool calls POST /api/v1/bets/ to execute the bet.
    It should ONLY be used after the user has reviewed a simulation from 'get_bet_simulation' and confirmed they want to proceed.
    The primary input for this tool must be the direct JSON object output from the 'get_bet_simulation' tool.

    Parameters:
    - confirmed_simulation_payload (object, required): The exact JSON object payload returned by the 'get_bet_simulation' tool. This payload is expected to conform to the Futuur API's BetPurchase schema.
    - bet_location (string, optional, default: 'MCP'): Identifier for the location/interface placing the bet. This is an MCP-specific parameter and is not part of the Futuur API request body for placing a bet.

    Warning: This tool executes a real bet; ensure the simulation was reviewed and confirmed by the user.
    Warning: Once executed, bets cannot be undone or reversed.
  `;

  schema = {
    confirmed_simulation_payload: {
      type: ConfirmedSimulationPayloadSchema,
      description: "The exact JSON object payload returned by the 'get_bet_simulation' tool. This contains all necessary details like outcome, amount, shares, currency, and position as confirmed by the simulation and should match the Futuur API's BetPurchase schema."
    },
    bet_location: {
      type: z.string().default("MCP").optional(),
      description: "Identifier for the location/interface placing the bet (e.g., 'MCP', 'WebAppV2'). This parameter is for MCP internal use if needed and is not sent to the Futuur API."
    }
  } as any; // Consistent with other tools

  async execute(input: PlaceBetExecuteInput) {
    try {
      // First, verify that the market has order_book_enabled = true
      const outcomeId = input.confirmed_simulation_payload.outcome;
      
      let marketData;
      try {
        // Find the market that contains our outcome
        const marketsResponse = await fetchFromFutuur("questions/", {
          params: { limit: 1000 }, // Get many markets to search through
          method: "GET"
        });
        
        // Find the market that contains our outcome
        const market = marketsResponse.results?.find((m: any) => 
          m.outcomes?.some((o: any) => o.id === outcomeId)
        );
        
        if (!market) {
          return {
            content: [{
              type: "text" as const,
              text: "Error: Could not find the market for the specified outcome ID."
            }]
          };
        }
        
        marketData = market;
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Unable to verify market details before placing bet. Please try again later."
          }]
        };
      }

      // Check if order_book_enabled is true
      if (!marketData.order_book_enabled) {
        return {
          content: [{
            type: "text" as const,
            text: "⚠️ **Betting Currently Restricted**\n\nThis market does not currently support betting as it requires order book functionality to be enabled. This is a temporary limitation while the platform is being updated.\n\nPlease try betting on markets that have order book trading enabled, or check back later when this feature is restored for all markets."
          }]
        };
      }

      // The `confirmed_simulation_payload` is the direct output from the 'get_bet_simulation' tool.
      // It includes our `tool_source` marker for validation and the actual simulation data.
      const { tool_source, ...apiRequestBody } = input.confirmed_simulation_payload;
      // `apiRequestBody` now contains only the fields intended for the Futuur API (outcome, amount, shares, etc.)
      // and excludes our internal `tool_source` marker.

      const data = await placeBet(apiRequestBody);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Error parsing logic from SimulateBetTool can be reused
      let finalErrorMessage = errorMessage;
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError && parsedError.url && parsedError.response) {
          finalErrorMessage = `API Error: Status ${parsedError.response} for ${parsedError.url}. Details: ${JSON.stringify(parsedError.fetchOptions)}`;
        }
      } catch (e) {
        // Not a JSON error string, use original
      }
      return {
        content: [
          {
            type: "text",
            text: `Error placing bet: ${finalErrorMessage}`,
          },
        ],
      };
    }
  }
}

export default PlaceBetTool;