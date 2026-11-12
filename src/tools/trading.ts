import { z } from "zod";

import { futuur } from "../api.js";
import { defineTool, READ, ToolInputError, WRITE, type ToolDef } from "../tool.js";

/**
 * Trading on Futuur goes through the order book: POST /orders/ places a buy ("bid") or a sell ("ask")
 * on one market (outcome), long ("Yes") or short ("No"). Every open event on production has its order
 * book enabled, so there is no separate purchase endpoint to call.
 */

const CURRENCIES = ["OOM", "USDC", "USDT", "USD"] as const;
const SIDES = ["bid", "ask"] as const;
const POSITIONS = ["long", "short"] as const;
const ORDER_STATUSES = ["open", "partial_filled", "filled", "canceled", "processing", "partial_filled_cancelled"] as const;
const ORDERINGS = [
  "-created", "created", "-price", "price", "-total", "total",
  "-expiration_date", "expiration_date", "-market_title", "market_title",
] as const;

/** Server minimums (ORDER_BOOK_MIN_SHARES / ORDER_BOOK_MIN_AMOUNT in production settings). */
const MIN_SHARES = 0.02;
const MIN_AMOUNT = 0.01;

type Side = (typeof SIDES)[number];
type Position = (typeof POSITIONS)[number];
type Currency = (typeof CURRENCIES)[number];

const market = z.number().int().positive().describe(
  "Market (outcome) id: the `id` of an entry in an event's `markets` list. This is not the event id.",
);
const side = z.enum(SIDES).describe(
  "`bid` buys shares; `ask` sells shares you already hold. To buy Yes use side bid with position long; to buy No use side bid with position short; to sell shares you hold use side ask with the position you hold.",
);
const position = z.enum(POSITIONS).describe(
  "`long` is the Yes side of the market (pays 1 if the outcome happens); `short` is the No side (pays 1 if it does not). Shares of each position trade in their own order book.",
);
const currency = z.enum(CURRENCIES).describe(
  "`OOM` is play money. `USDC`, `USDT` and `USD` are real money and only work on events whose available_currencies include them.",
);
const price = z.number().min(0.01).max(0.99).describe(
  "Limit price per share as a probability, in whole cents between 0.01 and 0.99 (for example 0.57).",
);
const timeInForce = z.enum(["gtc", "ioc"]);

function modeOf(c: Currency): "play_money" | "real_money" {
  return c === "OOM" ? "play_money" : "real_money";
}

/** Prices are whole cents on the server; reject anything else instead of letting the server do it. */
function toCents(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > 1e-9) {
    throw new ToolInputError(`price must be a whole number of cents (for example 0.57), got ${value}.`);
  }
  return rounded;
}

function toShares(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > 1e-9) {
    throw new ToolInputError(`shares must have at most 2 decimals (for example 12.5), got ${value}.`);
  }
  if (rounded <= MIN_SHARES) {
    throw new ToolInputError(`shares must be greater than ${MIN_SHARES}, got ${value}.`);
  }
  return rounded;
}

const round = (value: number, places: number): number => {
  const f = 10 ** places;
  return Math.round((value + Number.EPSILON) * f) / f;
};

interface BookLevel {
  price: number;
  total_shares: number;
  total_amount: number;
  total_fees?: number;
}

interface Fill {
  price: number;
  shares: number;
  amount: number;
}

/**
 * Walks book levels in execution order, consuming either a share target or a money budget.
 * A level's `total_amount` already includes taker fees (cost to buy on asks, net proceeds on bids),
 * so each level's per-share value is total_amount / total_shares, exactly as the server prices a
 * partial level.
 */
function walkBook(levels: BookLevel[], target: { shares: number } | { amount: number }) {
  const fills: Fill[] = [];
  let shares = 0;
  let amount = 0;
  for (const level of levels) {
    if (level.total_shares <= 0) continue;
    const perShare = level.total_amount / level.total_shares;
    let take: number;
    if ("shares" in target) {
      take = Math.min(level.total_shares, target.shares - shares);
    } else {
      take = Math.min(level.total_shares, perShare > 0 ? (target.amount - amount) / perShare : level.total_shares);
    }
    if (take <= 1e-9) break;
    fills.push({ price: level.price, shares: take, amount: take * perShare });
    shares += take;
    amount += take * perShare;
    if ("shares" in target ? shares >= target.shares - 1e-9 : amount >= target.amount - 1e-9) break;
  }
  return { fills, shares, amount };
}

function asLevels(raw: unknown): BookLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l: any) => ({
    price: Number(l.price),
    total_shares: Number(l.total_shares),
    total_amount: Number(l.total_amount),
    total_fees: l.total_fees === undefined ? undefined : Number(l.total_fees),
  }));
}

const simulationInput = {
  market,
  side: z.enum(SIDES).default("bid").describe(
    "`bid` (default) previews buying shares; `ask` previews selling shares you hold. To buy Yes use bid with position long; to buy No use bid with position short.",
  ),
  position,
  currency,
  shares: z.number().gt(MIN_SHARES).optional().describe(
    "Number of shares to buy or sell, at most 2 decimals. Give either `shares` or `amount`.",
  ),
  amount: z.number().min(MIN_AMOUNT).optional().describe(
    "Money to spend, in `currency`. Only for side bid (buying). The simulation works out how many shares that buys at today's prices. Give either `shares` or `amount`.",
  ),
  price: price.optional().describe(
    "Limit price per share, in whole cents between 0.01 and 0.99. A bid only fills at this price or lower, an ask at this price or higher. Omit for a market order that takes the best prices available.",
  ),
  time_in_force: timeInForce.optional().describe(
    "`gtc` (default): the part that cannot fill now rests on the book. `ioc`: the part that cannot fill now is cancelled; requires `price`.",
  ),
};

const getBetSimulation = defineTool({
  name: "get_bet_simulation",
  title: "Simulate an order",
  description:
    "Previews a buy or sell on one market without placing anything. It reads the public order book and walks it the way the matching engine would, " +
    "returning the estimated cost (or proceeds), average price, how many shares would fill immediately, and how many would rest on the book. " +
    "This is an estimate: the book can change before a real order is placed, and your balance and holdings are not checked. " +
    "Call it before place_bet and show the numbers to the user; `order` in the result holds the exact arguments to give place_bet.",
  input: simulationInput,
  annotations: READ,
  handler: async (args) => {
    const { market: marketId, side: orderSide, position: orderPosition, currency: orderCurrency } = args;
    const tif = args.time_in_force ?? "gtc";
    if ((args.shares === undefined) === (args.amount === undefined)) {
      throw new ToolInputError("Provide exactly one of `shares` or `amount`.");
    }
    if (args.amount !== undefined && orderSide === "ask") {
      throw new ToolInputError("`amount` can only be used when buying (side bid). To sell, give `shares`.");
    }
    if (tif === "ioc" && args.price === undefined) {
      throw new ToolInputError("time_in_force ioc needs a `price`. Add one, or omit time_in_force for a market order.");
    }
    const limit = args.price === undefined ? undefined : toCents(args.price);
    const requestedShares = args.shares === undefined ? undefined : toShares(args.shares);
    const mode = modeOf(orderCurrency);

    const book = await futuur(`markets/${marketId}/book/`, {
      query: { currency_mode: mode, position: orderPosition },
    });
    const asks = asLevels(book?.ask).sort((a, b) => a.price - b.price);
    const bids = asLevels(book?.bid).sort((a, b) => b.price - a.price);

    // A bid takes from the asks, cheapest first; an ask takes from the bids, highest first.
    const opposite = orderSide === "bid" ? asks : bids;
    const eligible =
      limit === undefined
        ? opposite
        : opposite.filter((l) => (orderSide === "bid" ? l.price <= limit + 1e-9 : l.price >= limit - 1e-9));

    let shares: number;
    if (requestedShares !== undefined) {
      shares = requestedShares;
    } else {
      const probe = walkBook(eligible, { amount: args.amount! });
      shares = Math.floor((probe.shares + 1e-9) * 100) / 100;
      if (shares <= MIN_SHARES) {
        throw new ToolInputError(
          `Spending ${args.amount} ${orderCurrency} buys no shares at ${limit === undefined ? "the current book" : `a limit of ${limit}`}. ` +
            "Raise the amount, raise the limit price, or give `shares` with a limit price to rest an order on the book.",
        );
      }
    }

    const fill = walkBook(eligible, { shares });
    const filledShares = round(Math.min(fill.shares, shares), 2);
    const warnings: string[] = [];
    const unfilled = round(shares - filledShares, 2);

    let resting = 0;
    if (unfilled > 0.005) {
      if (limit !== undefined && tif === "gtc") {
        resting = unfilled;
      } else if (args.amount !== undefined) {
        warnings.push(`The book can only absorb ${filledShares} shares for this amount; the rest of the amount would stay unspent.`);
      } else {
        warnings.push(
          limit === undefined
            ? `Only ${filledShares} of ${shares} shares are available on the book; a market order would fill that part and drop the rest.`
            : `Only ${filledShares} of ${shares} shares are available at this price; an ioc order would fill that part and cancel the rest.`,
        );
      }
    }
    if (filledShares === 0 && resting === 0) {
      warnings.push("Nothing would fill: there is no liquidity on this side of the book" + (limit === undefined ? "." : " at that price."));
    }
    if (orderSide === "ask") {
      warnings.push("Selling requires holding at least this many shares of this position, with none reserved by other open sell orders.");
    }

    const cash = round(fill.amount, 3);
    const restingValue = limit === undefined ? 0 : round(resting * limit, 3);
    const order: Record<string, unknown> = {
      market: marketId,
      side: orderSide,
      position: orderPosition,
      currency: orderCurrency,
      shares,
    };
    if (limit !== undefined) order.price = limit;
    if (args.time_in_force !== undefined) order.time_in_force = tif;

    return {
      estimate: true,
      note: "Estimated from the live order book at this moment; nothing has been placed.",
      market: marketId,
      side: orderSide,
      position: orderPosition,
      currency: orderCurrency,
      currency_mode: mode,
      order_type: limit === undefined ? "market" : "limit",
      time_in_force: tif,
      limit_price: limit ?? null,
      shares,
      immediate_fill: {
        shares: filledShares,
        [orderSide === "bid" ? "estimated_cost" : "estimated_proceeds"]: cash,
        average_price: filledShares > 0 ? round(fill.amount / fill.shares, 4) : null,
        fills: fill.fills.map((f) => ({ price: f.price, shares: round(f.shares, 2), amount: round(f.amount, 3) })),
      },
      resting_on_book: resting > 0 ? { shares: resting, price: limit } : null,
      ...(orderSide === "bid" ? { balance_needed: round(cash + restingValue, 3) } : {}),
      fees_included: mode === "real_money",
      best_bid: bids[0]?.price ?? null,
      best_ask: asks[0]?.price ?? null,
      last_price: book?.last_price ?? null,
      order,
      warnings,
    };
  },
});

const placeBet = defineTool({
  name: "place_bet",
  title: "Place an order",
  description:
    "Places a real order on a market: it spends or sells the user's actual balance and fills immediately against the book where it can. " +
    "Only call it after the user has explicitly confirmed a get_bet_simulation with these same numbers. " +
    "With a `price` it is a limit order (the unfilled part rests on the book unless time_in_force is ioc); without one it is a market order at the best available prices. " +
    "Returns the created order, including its id, status and fills; use cancel_order to withdraw a resting order.",
  input: {
    market,
    side,
    position,
    currency,
    shares: z.union([z.number().gt(MIN_SHARES), z.literal("max")]).describe(
      "Number of shares to buy or sell, at most 2 decimals and above 0.02. On side ask only, the string \"max\" sells every share you hold of this position that is not already reserved by an open sell order (requires `price`).",
    ),
    price: price.optional().describe(
      "Limit price per share, in whole cents between 0.01 and 0.99. A bid fills at this price or lower, an ask at this price or higher. Omit for a market order. Required for ioc and for shares \"max\".",
    ),
    time_in_force: timeInForce.optional().describe(
      "`gtc` (default): the part that cannot fill now rests on the book until filled, cancelled or expired. `ioc`: fill what is possible right now at `price` or better and cancel the rest; requires `price`.",
    ),
    expired_at: z.iso.datetime({ offset: true }).optional().describe(
      "ISO 8601 time (for example 2026-12-31T23:59:00Z) after which an unfilled resting order is cancelled automatically. Omit for no expiry.",
    ),
    cancel_conflicting_orders: z.boolean().optional().describe(
      "If true, your own open orders that tie up the balance or shares this order needs are cancelled first. If false or omitted, such a conflict makes the order fail.",
    ),
  },
  annotations: WRITE,
  handler: async (args) => {
    let shares: number | "max";
    if (args.shares === "max") {
      if (args.side !== "ask") throw new ToolInputError('shares "max" only works when selling (side ask). Give a number of shares to buy.');
      if (args.price === undefined) throw new ToolInputError('shares "max" needs a limit `price`.');
      shares = "max";
    } else {
      shares = toShares(args.shares);
    }
    if (args.time_in_force === "ioc" && args.price === undefined) {
      throw new ToolInputError("time_in_force ioc needs a `price`. Add one, or omit time_in_force for a market order.");
    }
    return futuur("orders/", {
      method: "POST",
      auth: "required",
      body: {
        market: args.market,
        side: args.side,
        position: args.position,
        currency: args.currency,
        shares,
        price: args.price === undefined ? undefined : toCents(args.price),
        time_in_force: args.time_in_force,
        expired_at: args.expired_at,
        cancel_conflicting_orders: args.cancel_conflicting_orders,
      },
    });
  },
});

const listOrders = defineTool({
  name: "list_orders",
  title: "List my orders",
  description:
    "Lists the user's own orders, newest first by default, 20 per page. Without `status` it returns only open orders (including ones still processing); " +
    "pass another status to see filled, cancelled or partially filled history. " +
    "Each order has id, market, side, position, price, shares requested and unfilled, shares_filled, status, average_price and expiry. Use the id with cancel_order.",
  input: {
    status: z.enum(ORDER_STATUSES).optional().describe(
      "Order status. Default `open`, which also includes orders still `processing` and only covers events that are still open. `partial_filled_cancelled` is an immediate-or-cancel order that filled in part and had the rest cancelled.",
    ),
    event: z.number().int().positive().optional().describe("Only orders on this event id."),
    market: z.number().int().positive().optional().describe("Only orders on this market (outcome) id."),
    side: z.enum(SIDES).optional().describe("Only buys (`bid`) or only sells (`ask`)."),
    currency_mode: z.enum(["play_money", "real_money"]).optional().describe("Only play-money (OOM) or only real-money orders."),
    currency: z.enum(CURRENCIES).optional().describe("Only orders in this exact currency."),
    search: z.string().max(255).optional().describe("Text to look for in the event or market title."),
    ordering: z.enum(ORDERINGS).optional().describe(
      "Sort order, default `-created` (newest first). A leading `-` means descending; `total` is the shares requested.",
    ),
    limit: z.number().int().min(1).max(20).optional().describe("Orders per page, 1 to 20. Default 20."),
    offset: z.number().int().min(0).optional().describe("Orders to skip, for paging. Default 0."),
  },
  annotations: READ,
  handler: async (args) =>
    futuur("orders/", {
      auth: "required",
      query: {
        status: args.status,
        event: args.event,
        market: args.market,
        side: args.side,
        currency_mode: args.currency_mode,
        currencies: args.currency ? [args.currency] : undefined,
        search: args.search,
        ordering: args.ordering,
        limit: args.limit,
        offset: args.offset,
      },
    }),
});

const cancelOrder = defineTool({
  name: "cancel_order",
  title: "Cancel an order",
  description:
    "Cancels one of the user's open or partially filled orders by id, releasing the balance or shares it reserved. " +
    "Shares that already filled stay filled; only the unfilled remainder is cancelled. " +
    "Orders that are filled, already cancelled or still processing cannot be cancelled, so check the status with list_orders first.",
  input: {
    order_id: z.number().int().positive().describe("Id of the order to cancel, from list_orders or place_bet."),
  },
  annotations: WRITE,
  handler: async ({ order_id }) => {
    await futuur(`orders/${order_id}/cancel/`, { method: "PATCH", auth: "required" });
    return { order_id, cancelled: true };
  },
});

const cancelAllOrders = defineTool({
  name: "cancel_all_orders",
  title: "Cancel all open orders",
  description:
    "Cancels every open order of the user, optionally only those on one event or one market. " +
    "Orders caught mid-fill are skipped and returned in `processing_order_ids`; try those again shortly with cancel_order. " +
    "To cancel everything on the account, pass `cancel_everything: true` and no event or market; only do that when the user asked for it.",
  input: {
    event: z.number().int().positive().optional().describe("Only cancel orders on this event id."),
    market: z.number().int().positive().optional().describe("Only cancel orders on this market (outcome) id."),
    cancel_everything: z.boolean().optional().describe(
      "Must be true when neither `event` nor `market` is given, to confirm that every open order on the account should be cancelled.",
    ),
  },
  annotations: WRITE,
  handler: async ({ event, market: marketId, cancel_everything }) => {
    if (event === undefined && marketId === undefined && cancel_everything !== true) {
      throw new ToolInputError(
        "Give an `event` or `market` to limit the cancellation, or set `cancel_everything` to true to cancel every open order on the account.",
      );
    }
    return futuur("orders/cancel-all/", {
      method: "POST",
      auth: "required",
      body: { event, market: marketId },
    });
  },
});

export const tradingTools: ToolDef<any>[] = [getBetSimulation, placeBet, listOrders, cancelOrder, cancelAllOrders];
