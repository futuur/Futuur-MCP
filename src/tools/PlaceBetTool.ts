import { z } from "zod";
import { createLimitOrder, fetchFromFutuur } from "../utils/api.js";
import { SIMULATION_PAYLOAD_SOURCE_MARKER } from "../utils/toolConstants.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

// Define the structure of the payload expected from the simulation service
// This should match the AddLimitOrder schema from OpenAPI / output of get_bet_simulation
const ConfirmedSimulationPayloadSchema = z.object({
  market: z.number(),
  side: z.enum(["bid", "ask"]),
  position: z.enum(["l", "s"]),
  price: z.union([z.number().min(0).max(1), z.null()]).optional(),
  shares: z.number(),
  amount: z.number().optional(),
  currency: z.string(),
  expired_at: z.string().optional(),
  cancel_conflicting_orders: z.boolean().optional(),
  tool_source: z.literal(SIMULATION_PAYLOAD_SOURCE_MARKER),
});

interface PlaceBetExecuteInput {
  confirmed_simulation_payload: Record<string, any>;
  bet_location?: string;
}

class PlaceBetTool extends FutuurBaseTool<PlaceBetExecuteInput> {
  name = "place_bet";
  description = `
    Place a limit order on a market using a previously confirmed simulation payload.
    This tool calls POST /orders/ to create a limit order.
    It should ONLY be used after the user has reviewed a simulation from 'get_bet_simulation' and confirmed they want to proceed.
    The primary input for this tool must be the direct JSON object output from the 'get_bet_simulation' tool.

    Parameters:
    - confirmed_simulation_payload (object, required): The exact JSON object payload returned by the 'get_bet_simulation' tool. This payload is expected to conform to the Futuur API's AddLimitOrder schema.
    - bet_location (string, optional, default: 'MCP'): Identifier for the location/interface placing the bet. This is an MCP-specific parameter and is not part of the Futuur API request body for placing an order.

    Warning: This tool executes a real order; ensure the simulation was reviewed and confirmed by the user.
    Warning: Once executed, orders cannot be undone or reversed (though they can be cancelled if still open).
  `;

  schema = {
    confirmed_simulation_payload: {
      type: ConfirmedSimulationPayloadSchema,
      description: "The exact JSON object payload returned by the 'get_bet_simulation' tool. This contains all necessary details like market, side, position, price, shares, and currency as confirmed by the simulation and should match the Futuur API's AddLimitOrder schema."
    },
    bet_location: {
      type: z.string().default("MCP").optional(),
      description: "Identifier for the location/interface placing the bet (e.g., 'MCP', 'WebAppV2'). This parameter is for MCP internal use if needed and is not sent to the Futuur API."
    }
  } as any;

  async execute(input: PlaceBetExecuteInput) {
    try {
      // First, verify that the event has order_book_enabled = true
      const marketId = input.confirmed_simulation_payload.market;
      
      let eventData;
      try {
        // Find the event that contains our market
        const eventsResponse = await fetchFromFutuur("events/", {
          params: { limit: 100 },
          method: "GET"
        });
        
        // Find the event that contains our market
        const event = eventsResponse.results?.find((e: any) => 
          e.markets?.some((m: any) => m.id === marketId)
        );
        
        if (!event) {
          return {
            content: [{
              type: "text" as const,
              text: "Error: Could not find the event for the specified market ID."
            }]
          };
        }
        
        eventData = event;
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Unable to verify event details before placing order. Please try again later."
          }]
        };
      }

      // Check if order_book_enabled is true (required for v2.0)
      if (!eventData.order_book_enabled) {
        return {
          content: [{
            type: "text" as const,
            text: "⚠️ **Order Book Not Enabled**\n\nThis event does not support order book trading. Order book must be enabled for limit orders.\n\nPlease try betting on events that have order book trading enabled."
          }]
        };
      }

      // The `confirmed_simulation_payload` is the direct output from the 'get_bet_simulation' tool.
      // It includes our `tool_source` marker for validation and the actual simulation data.
      const { tool_source, ...apiRequestBody } = input.confirmed_simulation_payload;
      // `apiRequestBody` now contains only the fields intended for the Futuur API (market, side, position, price, shares, currency, etc.)
      // and excludes our internal `tool_source` marker.

      // Add bet_location if provided (this is an optional field in AddLimitOrder schema)
      if (input.bet_location) {
        apiRequestBody.bet_location = input.bet_location;
      }

      const data = await createLimitOrder(apiRequestBody as any);

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
            text: `Error placing order: ${finalErrorMessage}`,
          },
        ],
      };
    }
  }
}

export default PlaceBetTool;
