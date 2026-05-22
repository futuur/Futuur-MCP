import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
import { FutuurBaseTool } from "./FutuurBaseTool.js";

interface CancelOrderInput {
  id: number;
}

class CancelOrderTool extends FutuurBaseTool<CancelOrderInput> {
  name = "cancel_order";
  description = `
    Cancel an open limit order by its ID.

    Common use cases:
    - When the user wants to cancel a pending buy or sell order.
    - When the user says "Cancel my order" after viewing their open orders via list_orders.

    Warning: Only orders with status 'open' or 'partial_filled' can be cancelled.
    Warning: Partially filled orders will be cancelled for the unfilled portion only.
    Warning: This action cannot be undone once the order is cancelled.
  `;

  schema = {
    id: {
      type: z.preprocess(
        (val) => (typeof val === "string" ? parseInt(val, 10) : val),
        z.number({ required_error: "Order ID is required." })
      ),
      description: "The ID of the order to cancel",
    },
  } as any;

  async execute(input: CancelOrderInput) {
    try {
      const data = await fetchFromFutuur(`orders/${input.id}/cancel/`, {
        method: "PATCH",
        body: {},
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error cancelling order ${input.id}: ${String(error)}` },
        ],
      };
    }
  }
}

export default CancelOrderTool;
