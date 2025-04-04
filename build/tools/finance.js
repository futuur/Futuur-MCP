import { z } from "zod";
import { fetchFromFutuur } from "../utils/api.js";
export function registerFinanceTools(server) {
    // Tool to convert from USD to another currency
    server.tool("convert_from_usd", {
        value: z.number().positive().describe("Amount in USD to convert"),
        to_currency: z.string().describe("Target currency code"),
    }, async ({ value, to_currency }) => {
        try {
            const rates = await fetchFromFutuur("bets/rates/");
            const usdRates = rates.find((r) => r.currency === "USD");
            if (!usdRates) {
                throw new Error("USD rates not found");
            }
            const inUsd = 1 / usdRates.rates[to_currency];
            const rate = to_currency === "BTC" ? inUsd / 1000 : inUsd;
            const result = value / rate;
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            from_amount: value,
                            from_currency: "USD",
                            to_amount: result,
                            to_currency: to_currency,
                            rate: rate,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error converting from USD: ${String(error)}`,
                    },
                ],
            };
        }
    });
    // Tool to convert to USD from another currency
    server.tool("convert_to_usd", {
        value: z.number().positive().describe("Amount to convert to USD"),
        from_currency: z.string().describe("Source currency code"),
    }, async ({ value, from_currency }) => {
        try {
            const rates = await fetchFromFutuur("bets/rates/");
            const usdRates = rates.find((r) => r.currency === "USD");
            if (!usdRates) {
                throw new Error("USD rates not found");
            }
            const inUsd = 1 / usdRates.rates[from_currency];
            const result = inUsd * value;
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            from_amount: value,
                            from_currency: from_currency,
                            to_amount: result,
                            to_currency: "USD",
                            rate: inUsd,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error converting to USD: ${String(error)}`,
                    },
                ],
            };
        }
    });
    // Tool to format numbers with locale
    server.tool("format_number", {
        value: z.number().describe("Number to format"),
        locale: z
            .string()
            .default("en-US")
            .describe("Locale string (e.g. 'en-US')"),
        min_decimals: z
            .number()
            .min(0)
            .default(2)
            .describe("Minimum decimal places"),
        max_decimals: z
            .number()
            .min(0)
            .default(2)
            .describe("Maximum decimal places"),
    }, async ({ value, locale, min_decimals, max_decimals }) => {
        try {
            const formatted = new Intl.NumberFormat(locale, {
                minimumFractionDigits: min_decimals,
                maximumFractionDigits: max_decimals,
            }).format(value);
            return {
                content: [
                    {
                        type: "text",
                        text: formatted,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error formatting number: ${String(error)}`,
                    },
                ],
            };
        }
    });
    // Tool to get current exchange rates
    server.tool("get_exchange_rates", {
        base_currency: z
            .string()
            .optional()
            .describe("Optional base currency to filter rates"),
    }, async ({ base_currency }) => {
        try {
            const rates = await fetchFromFutuur("bets/rates/");
            if (base_currency) {
                const baseRates = rates.find((r) => r.currency === base_currency);
                if (!baseRates) {
                    throw new Error(`Rates for ${base_currency} not found`);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(baseRates, null, 2),
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(rates, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error getting exchange rates: ${String(error)}`,
                    },
                ],
            };
        }
    });
}
