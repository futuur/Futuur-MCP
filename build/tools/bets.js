import { z } from "zod";
import { fetchFromFutuur, simulateBetPurchase } from "../utils/api.js";
export function registerBetTools(server) {
    // Tool to get user bets
    server.tool("get_user_bets", {
        limit: z.number().describe("Maximum number of bets to return"),
        offset: z.number().describe("Offset for pagination"),
        active: z
            .boolean()
            .optional()
            .describe("Filter by active wagers (wagers with status purchased)"),
        currency_mode: z
            .enum(["play_money", "real_money", ""])
            .describe("Filter by currency mode"),
        following: z
            .boolean()
            .optional()
            .describe("Filter by bets made by users you follow"),
        past_bets: z
            .boolean()
            .optional()
            .describe("Filter by not active wagers (wagers with status sold, won, lost, disabled)"),
        question: z.number().optional().describe("Filter by question ID"),
        user: z.number().optional().describe("Filter by user ID"),
    }, async ({ limit, offset, active, currency_mode, following, past_bets, question, user, }) => {
        try {
            // Build query parameters
            const params = {};
            if (limit !== undefined)
                params.limit = limit;
            if (offset !== undefined)
                params.offset = offset;
            if (active !== undefined)
                params.active = active;
            if (currency_mode !== undefined)
                params.currency_mode = currency_mode;
            if (following !== undefined)
                params.following = following;
            if (past_bets !== undefined)
                params.past_bets = past_bets;
            if (question !== undefined)
                params.question = question;
            if (user !== undefined)
                params.user = user;
            const data = await fetchFromFutuur("bets", {
                params,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching user bets: ${String(error)}`,
                    },
                ],
            };
        }
    });
    // Tool to place a bet
    server.tool("place_bet", {
        outcome: z.number().describe("ID of the outcome to bet on"),
        amount: z
            .number()
            .positive()
            .describe("Amount to bet (must be positive)"),
        shares: z.number().optional().describe("Number of shares to purchase"),
        currency: z
            .string()
            .max(11)
            .default("OOM")
            .describe("Currency to use for the bet"),
        position: z
            .enum(["l", "s"])
            .default("l")
            .describe("Position type: 'l' for long (bet in favor) or 's' for short (bet against)"),
        fiat_equivalent_mode: z
            .boolean()
            .default(false)
            .optional()
            .describe("Whether to use fiat equivalent mode"),
        bet_location: z
            .string()
            .default("LLM")
            .optional()
            .describe("Location where the bet was placed"),
        outcomes_type: z
            .enum(["yesno", "custom"])
            .optional()
            .describe("Type of market outcomes"),
    }, async ({ outcome, amount, shares, currency, position, fiat_equivalent_mode, bet_location, outcomes_type, }) => {
        try {
            // At least one of amount or shares must be provided
            if (amount === undefined && shares === undefined) {
                throw new Error("Either amount or shares must be provided");
            }
            // Validate amount is positive
            if (amount !== undefined && amount <= 0) {
                throw new Error("Amount must be positive");
            }
            // For yes/no markets, position must be 'l'
            if (outcomes_type === "yesno" && position !== "l") {
                throw new Error("Position must be 'l' (long) for yes/no markets");
            }
            // Always use simulation to get the exact purchase parameters
            const simulationResult = await simulateBetPurchase(outcome, amount, currency, position);
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
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error placing bet: ${String(error)}`,
                    },
                ],
            };
        }
    });
    // Tool to sell a bet
    server.tool("sell_bet", {
        id: z.number().describe("ID of the bet to sell"),
        shares: z
            .number()
            .optional()
            .describe("Number of shares to sell (for partial sell)"),
        amount: z
            .number()
            .optional()
            .describe("Amount to receive (for partial sell)"),
    }, async ({ id, shares, amount }) => {
        try {
            const requestBody = {};
            // For partial sell, include shares and/or amount
            if (shares !== undefined)
                requestBody.shares = shares;
            if (amount !== undefined)
                requestBody.amount = amount;
            const data = await fetchFromFutuur(`bets/${id}`, {
                method: "PATCH",
                body: Object.keys(requestBody).length > 0 ? requestBody : undefined,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error selling bet: ${String(error)}`,
                    },
                ],
            };
        }
    });
    // Tool to get partial sell amount
    server.tool("get_partial_sell_amount", {
        id: z.number().describe("ID of the bet"),
        shares: z.number().describe("Number of shares to sell"),
    }, async ({ id, shares }) => {
        try {
            const data = await fetchFromFutuur(`bets/${id}/get_partial_amount_on_sell/`, {
                params: { shares },
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error getting partial sell amount: ${String(error)}`,
                    },
                ],
            };
        }
    });
    // Tool to get current rates
    server.tool("get_rates", {}, async () => {
        try {
            const data = await fetchFromFutuur("bets/rates/", {});
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error getting rates: ${String(error)}`,
                    },
                ],
            };
        }
    });
}
