import { z } from "zod";

import { futuur, FutuurApiError } from "../api.js";
import { defineTool, READ, ToolInputError, WRITE, type ToolDef } from "../tool.js";

/** Currencies the orders endpoint accepts (OOM play money and the stable real-money currencies). */
const ORDER_CURRENCIES = ["OOM", "USDC", "USDT", "USD"];

const wagerId = z.number().int().positive().describe("Wager id, as returned by get_user_bets (field `id`). This is not a market id or an event id.");

const isObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function pick(source: Record<string, any>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

/** Wager objects embed whole market, user and per-action copies; keep ids, prices, amounts and status. */
function slimWager(wager: unknown): unknown {
  if (!isObject(wager)) return wager;
  const out: Record<string, any> = { ...wager };
  if (isObject(out.user)) out.user = pick(out.user, ["id", "username"]);
  if (isObject(out.market)) {
    out.market = pick(out.market, [
      "id", "title", "title_verbose", "price", "long_label", "short_label", "status", "resolution", "resolution_display",
    ]);
  }
  if (Array.isArray(out.actions)) {
    out.actions = out.actions.map((action) =>
      isObject(action)
        ? pick(action, [
            "id", "action", "action_display", "price", "shares", "amount", "profit", "currency", "position", "created",
            "maker_rebate",
          ])
        : action,
    );
  }
  return out;
}

/** Plain Python exceptions from the legacy sale path surface as an HTTP 500 whose error code is the class name. */
const SELL_ERRORS: Record<string, string> = {
  InvalidOperation: "This wager is not an open position (its status is not purchased), so there is nothing to sell.",
  NotAllowedOperation: "This wager belongs to another user; only the owner can sell it.",
  ActionDuplicated: "This wager was sold a moment ago. Wait a few seconds and check get_wager_details before retrying.",
  InvalidPartialSellShares:
    "Invalid number of shares for a partial sale: it must not exceed the shares held and must be at least the " +
    "minimum trade size. Omit shares to sell the whole position.",
  Closed: "The event is closed for trading, so the position cannot be sold until it resolves.",
};

function errorCode(error: FutuurApiError): string | undefined {
  const detail = error.detail as any;
  return Array.isArray(detail?.errors) ? detail.errors[0]?.code : undefined;
}

export const positionTools: ToolDef<any>[] = [
  defineTool({
    name: "get_user_bets",
    title: "List my bets",
    description:
      "Lists wagers (positions) with pagination, newest first; by default the authenticated user's own. Each wager has " +
      "its wager `id`, `status` (purchased = open, sold, won, lost, cancelled, disabled), `position` (long or short), " +
      "`shares`, `currency`, the cost basis, the current sale value (`amount_on_sell`), plus the `market` (id, title) " +
      "and `event` (id, title, order_book_enabled) it belongs to. Use `active` for open positions or `past_bets` for " +
      "settled ones; pass a wager id to get_wager_details for the purchase and sale history. At most 20 wagers per page.",
    input: {
      active: z.boolean().optional().describe("true: only open wagers (status purchased). Omit for no status filter. Cannot be combined with past_bets."),
      past_bets: z.boolean().optional().describe("true: only finished wagers (status won, lost, sold or disabled). Omit for no status filter. Cannot be combined with active."),
      currency_mode: z
        .enum(["play_money", "real_money", "all"])
        .default("all")
        .describe("play_money = OOM wagers, real_money = USDC/USDT/USD wagers, all = both (default)."),
      event: z.number().int().positive().optional().describe("Only wagers on this event id."),
      following: z.boolean().optional().describe("true: only wagers by users you follow. Only works together with `event`."),
      user: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Another user's id, to read their public play-money wagers. Omit for the authenticated user's own wagers."),
      limit: z.number().int().min(1).max(20).default(20).describe("Wagers per page, 1 to 20 (default 20)."),
      offset: z.number().int().min(0).max(10000).default(0).describe("Number of wagers to skip, for paging (default 0, maximum 10000)."),
    },
    annotations: READ,
    handler: async ({ active, past_bets, currency_mode, event, following, user, limit, offset }) => {
      if (active && past_bets) {
        throw new ToolInputError("Pass either active or past_bets, not both: active selects open wagers, past_bets selects finished ones.");
      }
      if (following && event === undefined) {
        throw new ToolInputError("`following` only works together with `event`: pass the event id whose followed-user wagers you want.");
      }
      const data = await futuur("wagers/", {
        auth: "required",
        query: {
          user,
          event,
          active,
          past_bets,
          following,
          currency_mode: currency_mode === "all" ? undefined : currency_mode,
          limit,
          offset,
        },
      });
      return isObject(data) && Array.isArray(data.results) ? { ...data, results: data.results.map(slimWager) } : data;
    },
  }),

  defineTool({
    name: "get_wager_details",
    title: "Get wager details",
    description:
      "Returns one wager by its wager id: status, long or short position, shares held, cost basis, ROI, what it pays " +
      "if it wins (`amount_on_win`), what it would sell for now (`amount_on_sell`), the `market` and `event` it belongs " +
      "to, and the `actions` history of purchases, sales and resolution. Use it to inspect a position or to check " +
      "the result after a sale. `event.order_book_enabled` tells you how the position can be sold; see sell_bet. " +
      "Get wager ids from get_user_bets.",
    input: { id: wagerId },
    annotations: READ,
    handler: async ({ id }) => slimWager(await futuur(`wagers/${id}/`, { auth: "required" })),
  }),

  defineTool({
    name: "get_partial_sell_amount",
    title: "Simulate selling shares",
    description:
      "Simulates what selling shares of a wager would return, without selling anything: returns {amount, shares, " +
      "price} for the user's wager. Production values the position from the current order-book bids; it can return " +
      "an amount of 0 on the first call for a market while its book cache warms up, so call it again before " +
      "believing a 0. Run this and show the result to the user before sell_bet. Pass the wager id, not a market id.",
    input: {
      id: wagerId,
      shares: z
        .number()
        .positive()
        .optional()
        .describe("Number of shares to simulate selling; must not exceed the shares held in the wager. Omit to simulate selling the entire position."),
    },
    annotations: READ,
    handler: async ({ id, shares }) => {
      const result = await futuur(`wagers/${id}/get_partial_amount_on_sell/`, { auth: "required", query: { shares } });
      if (shares === undefined || !isObject(result)) return result;
      return {
        ...result,
        note:
          "Futuur prices the whole position from the order-book bids and ignores the requested share count, so `amount` " +
          "is the proceeds for the entire wager and `price` (amount divided by shares) is only an average. Treat it as " +
          "a rough indication for a partial sale.",
      };
    },
  }),

  defineTool({
    name: "sell_bet",
    title: "Sell a bet",
    description:
      "Sells all or part of an open wager (position) for the user. It moves the user's balance and cannot be undone, so " +
      "only run it after the user has confirmed a simulation for the same wager and shares (get_bet_simulation with " +
      "side ask, or get_partial_sell_amount). Pass the wager id; omit `shares` to sell the whole position. On order-book " +
      "events, which is every current market, the sale is placed as a sell order on the wager's market: without `price` " +
      "it sells immediately at the best bids, with `price` it is a limit order that may rest on the book. The result " +
      "then contains the created `order`.",
    input: {
      id: wagerId,
      shares: z
        .number()
        .positive()
        .optional()
        .describe("Number of shares to sell. Omit to sell the entire position. Must not exceed the shares held; selling all of them is the same as omitting it."),
      price: z
        .number()
        .min(0.01)
        .max(0.99)
        .optional()
        .describe("Order-book events only: minimum price per share to accept, in whole cents between 0.01 and 0.99. Omit to sell immediately at the best available bids."),
    },
    annotations: WRITE,
    handler: async ({ id, shares, price }) => {
      const [wager, me] = await Promise.all([
        futuur(`wagers/${id}/`, { auth: "required" }),
        futuur("me/", { auth: "required" }),
      ]);
      if (!isObject(wager)) throw new ToolInputError(`Could not read wager ${id}.`);

      if (isObject(wager.user) && isObject(me) && wager.user.id !== undefined && me.id !== undefined && wager.user.id !== me.id) {
        throw new ToolInputError(`Wager ${id} belongs to another user. Only the authenticated user's own wagers can be sold.`);
      }
      if (wager.status !== "purchased") {
        throw new ToolInputError(
          `Wager ${id} has status "${wager.status}", so there is nothing to sell. Only wagers with status purchased are open positions.`,
        );
      }
      const event = isObject(wager.event) ? wager.event : {};
      const market = isObject(wager.market) ? wager.market : {};
      if (event.is_wagerable === false) {
        throw new ToolInputError(`The event of wager ${id} is closed for trading, so the wager cannot be sold until the event resolves.`);
      }

      const held = Number(wager.shares);
      if (shares !== undefined && Number.isFinite(held) && shares > held) {
        throw new ToolInputError(`Wager ${id} holds only ${held} shares, so ${shares} cannot be sold. Omit shares to sell the whole position.`);
      }

      // Order-book events (every current market): the position is sold by placing an ask order.
      if (event.order_book_enabled === true && ORDER_CURRENCIES.includes(String(wager.currency))) {
        // "max" sells everything not reserved by other sell orders, but the API only takes it with a price.
        const quantity = shares ?? (price !== undefined ? "max" : Math.floor(held * 100 + 1e-9) / 100);
        const order = await futuur("orders/", {
          method: "POST",
          auth: "required",
          body: { market: market.id, side: "ask", position: wager.position, currency: wager.currency, shares: quantity, price },
        });
        return {
          sold_via: "order",
          note:
            price === undefined
              ? "Placed a market sell order: it fills against the current bids, and any part the book cannot absorb is dropped. Check the order's status and shares_filled."
              : "Placed a limit sell order: the part that cannot fill at this price now rests on the book until it fills or is cancelled with cancel_order.",
          wager_id: id,
          order,
        };
      }
      if (price !== undefined) {
        throw new ToolInputError(
          `Wager ${id} is not on an order-book event, so it sells at the current market value and \`price\` does not apply. Remove price and try again.`,
        );
      }
      const partial = shares !== undefined && !(Number.isFinite(held) && shares === held);

      try {
        const sold = await futuur(`wagers/${id}/`, {
          method: "PATCH",
          auth: "required",
          body: partial ? { shares } : {},
        });
        return slimWager(sold);
      } catch (error) {
        const known = error instanceof FutuurApiError ? SELL_ERRORS[errorCode(error) ?? ""] : undefined;
        if (known) throw new ToolInputError(known);
        throw error;
      }
    },
  }),
];
