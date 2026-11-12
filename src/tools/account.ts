import { z } from "zod";

import { futuur } from "../api.js";
import { defineTool, READ, type ToolDef } from "../tool.js";

/** Settings worth showing a trader; the rest of `settings` is UI onboarding flags. */
const SETTINGS_KEPT = ["language", "auto_cancel_conflicting_orders", "last_currency_selected", "fiat_equivalent_mode"];
/** Fields of GET me/ that are UI or experiment plumbing, not account data. */
const PROFILE_DROPPED = ["picture", "has_custom_picture", "sort_algorithm", "test_segments", "api_version", "attribution"];

function slimProfile(profile: any): unknown {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return profile;
  const out: Record<string, unknown> = { ...profile };
  for (const key of PROFILE_DROPPED) delete out[key];
  if (out.settings && typeof out.settings === "object") {
    const settings = out.settings as Record<string, unknown>;
    out.settings = Object.fromEntries(SETTINGS_KEPT.filter((k) => k in settings).map((k) => [k, settings[k]]));
  }
  return out;
}

export const accountTools: ToolDef<any>[] = [
  defineTool({
    name: "get_user_profile",
    title: "Get my profile",
    description:
      "Returns the authenticated user's own account: id, username, email, email and KYC status, whether real-money " +
      "trading is enabled for the public API (public_api_real_money_enabled), wager counts, trading-relevant " +
      "settings and a `wallet` object with the balance in each currency. Use it to answer who the user is, whether " +
      "real money can be traded through the API, or for a quick balance snapshot; use get_balances to read one " +
      "currency's balance. Read-only.",
    input: {},
    annotations: READ,
    handler: async () => slimProfile(await futuur("me/", { auth: "required" })),
  }),

  defineTool({
    name: "get_balances",
    title: "Get my balances",
    description:
      "Returns the authenticated user's ledger balances as a list with one {currency, amount} row per currency, for " +
      "example OOM (play money) and USDC (real money). Use it before placing a bet to check the user can afford it, " +
      "or to answer how much the user holds. Pass `currency` to get just that one row. Read-only.",
    input: {
      currency: z
        .string()
        .trim()
        .min(1)
        .max(11)
        .optional()
        .describe("Only return the balance in this currency code, matched case-insensitively (e.g. OOM, USDC, USDT, USD). Omit for every currency."),
    },
    annotations: READ,
    handler: async ({ currency }) => futuur("me/balances/", { auth: "required", query: { currency } }),
  }),

  defineTool({
    name: "get_user_ranking",
    title: "Get my leaderboard ranking",
    description:
      "Returns the authenticated user's current position on the Futuur leaderboard as {ranking}. Use it when the " +
      "user asks where they stand relative to other traders. Read-only; it only covers the authenticated user.",
    input: {},
    annotations: READ,
    handler: async () => futuur("me/ranking/", { auth: "required" }),
  }),
];
