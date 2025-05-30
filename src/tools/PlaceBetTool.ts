import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { fetchFromFutuur, SimulateBetPurchaseParams } from "../utils/api.js";
import { SIMULATION_PAYLOAD_SOURCE_MARKER } from "../utils/toolConstants";

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

interface PlaceBetConfirmedInput {
  // This object structure should match the output of simulateBetPurchase
  confirmed_simulation_payload: z.infer<typeof ConfirmedSimulationPayloadSchema>;
  bet_location?: string; // Optional: Location where the bet was placed
  // fiat_equivalent_mode is likely handled by the simulation or part of its response, not a separate flag here.
  // outcomes_type is also likely implicitly handled or part of simulation context, not needed for POST if payload is complete.
}

class PlaceBetTool extends MCPTool<PlaceBetConfirmedInput> {
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

  schema = z.object({
    confirmed_simulation_payload: ConfirmedSimulationPayloadSchema.describe("The exact JSON object payload returned by the 'get_bet_simulation' tool. This contains all necessary details like outcome, amount, shares, currency, and position as confirmed by the simulation and should match the Futuur API's BetPurchase schema."),
    bet_location: z.string().default("MCP").optional().describe("Identifier for the location/interface placing the bet (e.g., 'MCP', 'WebAppV2'). This parameter is for MCP internal use if needed and is not sent to the Futuur API.")
  }) as any; // Consistent with other tools

  async execute(input: PlaceBetConfirmedInput) {
    try {
      // The `confirmed_simulation_payload` is the direct output from the 'get_bet_simulation' tool.
      // It includes our `tool_source` marker for validation and the actual simulation data.
      const { tool_source, ...apiRequestBody } = input.confirmed_simulation_payload;
      // `apiRequestBody` now contains only the fields intended for the Futuur API (outcome, amount, shares, etc.)
      // and excludes our internal `tool_source` marker.

      const data = await fetchFromFutuur("bets/", {
        method: "POST",
        body: apiRequestBody, // Send the stripped payload to Futuur API
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