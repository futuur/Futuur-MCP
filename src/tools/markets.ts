import { z } from "zod";

import { futuur, FutuurApiError, hasKeys } from "../api.js";
import { defineTool, READ, ToolInputError, type ToolDef } from "../tool.js";

// ---------------------------------------------------------------------------------------------
// Shaping helpers. The production API returns full UI payloads (thumbnails, SEO blocks, per-user
// fields, experiment flags); these keep what a trader or an LLM needs.
// ---------------------------------------------------------------------------------------------

const CURRENCY_MODES = ["play_money", "real_money"] as const;
const EVENT_ORDERINGS = [
  "relevance", "-relevance", "created_on", "-created_on", "bet_end_date", "-bet_end_date",
  "wagers_count", "-wagers_count", "volume", "-volume", "open_date", "-open_date",
  "resolve_date", "-resolve_date",
] as const;

type Json = Record<string, any>;

function categoryPath(category: unknown): string | null {
  if (!Array.isArray(category) || category.length === 0) return null;
  return category.map((c: Json) => c.title).join(" > ");
}

/** An event's category is returned as the chain root -> leaf; report the leaf plus the readable path. */
function leafCategory(category: unknown): Json | null {
  if (!Array.isArray(category) || category.length === 0) return null;
  const leaf = category[category.length - 1] as Json;
  return { id: leaf.id, title: leaf.title, slug: leaf.slug, path: categoryPath(category) };
}

/** The API uses "-" for "not resolved yet". */
function resolutionOf(market: Json): string | null {
  const resolution = market.resolution_display ?? market.resolution;
  return resolution && resolution !== "-" ? resolution : null;
}

function slimMarket(market: Json, detailed: boolean): Json {
  const out: Json = {
    id: market.id,
    title: market.title,
    price: market.price,
    long_label: market.long_label,
    short_label: market.short_label,
    status: market.status,
    resolution: resolutionOf(market),
    volume_play_money: market.volume_play_money,
    volume_real_money: market.volume_real_money,
  };
  if (detailed) {
    Object.assign(out, {
      liquidity_play_money: market.liquidity_play_money,
      liquidity_real_money: market.liquidity_real_money,
      depth_play_money: market.depth_play_money,
      depth_real_money: market.depth_real_money,
      volume_24h_play_money: market.volume_24h_play_money,
      volume_24h_real_money: market.volume_24h_real_money,
      last_trade_at_play_money: market.last_trade_at_play_money,
      last_trade_at_real_money: market.last_trade_at_real_money,
      description: htmlToText(market.description),
      resolution_description: htmlToText(market.resolution_description),
    });
  }
  return out;
}

/** Descriptions are authored as HTML; a model reads plain text better. */
export function htmlToText(html: unknown): string | null {
  if (typeof html !== "string" || !html.trim()) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slimEvent(event: Json, detailed: boolean): Json {
  const out: Json = {
    id: event.id,
    title: event.title,
    slug: event.slug,
    status: event.status,
    is_wagerable: event.is_wagerable,
    bet_end_date: event.bet_end_date,
    event_start_date: event.event_start_date,
    event_end_date: event.event_end_date,
    resolve_date: event.resolve_date,
    category: leafCategory(event.category),
    tags: Array.isArray(event.tags) ? event.tags.map((t: Json) => t.slug) : [],
    available_currencies: event.available_currencies,
    markets_correlation: event.markets_correlation,
    resolution_mode: event.resolution_mode,
    order_book_enabled: event.order_book_enabled,
    volume_play_money: event.volume_play_money,
    volume_real_money: event.volume_real_money,
    wagers_count_play_money: event.wagers_count_play_money,
    wagers_count_real_money: event.wagers_count_real_money,
  };
  if (detailed) {
    Object.assign(out, {
      description: htmlToText(event.description),
      cancellation_reason: event.cancellation_reason ?? null,
      liquidity_play_money: event.liquidity_play_money,
      liquidity_real_money: event.liquidity_real_money,
      comment_count: event.comment_count,
      is_real_money_bets_forbidden: event.is_real_money_bets_forbidden,
      event_extra_data: event.event_extra_data ?? null,
    });
  }
  out.markets = Array.isArray(event.markets) ? event.markets.map((m: Json) => slimMarket(m, detailed)) : [];
  return out;
}

function requireTimezone(name: string, value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ToolInputError(`${name} must be an ISO 8601 timestamp with a timezone, e.g. 2026-11-01T00:00:00Z.`);
  }
}

// ---------------------------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------------------------

interface RateTable {
  rates: Record<string, number>;
  last_update?: string;
  update_code?: string;
}
type RatesResponse = Record<string, RateTable>;

const ratesAvailableHint = (rates: RatesResponse) =>
  `Bases: ${Object.keys(rates).join(", ")}. Quotable currencies: ${Object.keys(rates.USD?.rates ?? {}).join(", ")}.`;

/** USD value of one unit of `currency`, from the most precise table available. */
function usdPerUnit(rates: RatesResponse, currency: string): { value: number; updated: string | undefined } {
  const code = currency.trim().toUpperCase();
  if (code === "USD") return { value: 1, updated: rates.USD?.last_update };
  if (code === "OOM") {
    throw new ToolInputError(
      "OOM is Futuur's play-money currency and has no USD exchange rate. Real-money balances use USDC or USDT.",
    );
  }
  const own = rates[code]?.rates?.USD;
  if (typeof own === "number" && own > 0) return { value: own, updated: rates[code].last_update };
  const perUsd = rates.USD?.rates?.[code];
  if (typeof perUsd === "number" && perUsd > 0) return { value: 1 / perUsd, updated: rates.USD.last_update };
  throw new ToolInputError(`Unsupported currency "${currency}". ${ratesAvailableHint(rates)}`);
}

function roundSig(value: number, digits = 8): number {
  return Number(value.toPrecision(digits));
}

async function loadRates(): Promise<RatesResponse> {
  return futuur<RatesResponse>("exchange_rates/latest/");
}

// ---------------------------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------------------------

export const marketTools: ToolDef<any>[] = [
  defineTool({
    name: "get_markets",
    title: "Search events and markets",
    description:
      "Lists or searches Futuur events, each with its markets and current prices, in one page. An event is the " +
      "question (id, title, status, close date, category, volume); a market is one tradeable outcome of it, and a " +
      "market's `price` is the probability of the long position (0 to 1) in each available currency (OOM is play " +
      "money, USDC is real money). Use it to find events by text, category, tag, status or close date, or to rank " +
      "them by volume or recent activity. Returns `total`, `returned` and `next_offset` (null on the last page); " +
      "pass next_offset as `offset` for the next page. Use get_market_details for one event's full description.",
    input: {
      search: z.string().min(1).max(100).optional().describe(
        "Case-insensitive text search across event titles, market names, categories and tags. Max 100 characters.",
      ),
      categories: z.array(z.number().int().positive()).optional().describe(
        "Category ids (see get_categories). A top-level category includes all its subcategories. An event matching " +
          "any listed category is returned.",
      ),
      category_slugs: z.array(z.string().min(1)).optional().describe(
        "Category slugs such as \"crypto-prices\", as an alternative to ids. If both are given, an event must match both.",
      ),
      tags: z.array(z.string().min(1)).max(10).optional().describe(
        "Up to 10 tag slugs or names (case-insensitive). An event matching any listed tag is returned.",
      ),
      status: z.enum(["open", "live", "pending_resolution", "resolved"]).default("open").describe(
        "Which events to list. \"open\" (default): open for trading, plus recently closed ones awaiting resolution. " +
          "\"live\": live now or starting within 12 hours. \"pending_resolution\": closed but not resolved yet. " +
          "\"resolved\": resolved events, newest first.",
      ),
      currency_mode: z.enum(CURRENCY_MODES).default("play_money").describe(
        "\"play_money\" (default): events tradeable with OOM play money. \"real_money\": events tradeable with real " +
          "money (USDC/USDT). Also decides which volume the \"volume\" ordering uses.",
      ),
      ordering: z.enum(EVENT_ORDERINGS).optional().describe(
        "Sort order; a leading \"-\" means descending. Allowed: relevance, created_on, bet_end_date, wagers_count, " +
          "volume, open_date, resolve_date (each with or without \"-\"). Defaults to \"-relevance\" for a normal " +
          "listing (resolved events are always newest first).",
      ),
      bet_end_date_after: z.string().optional().describe(
        "Only events whose trading closes at or after this time. ISO 8601 with a timezone, e.g. 2026-11-01T00:00:00Z.",
      ),
      bet_end_date_before: z.string().optional().describe(
        "Only events whose trading closes at or before this time. ISO 8601 with a timezone, e.g. 2026-12-01T00:00:00Z.",
      ),
      hide_my_bets: z.boolean().optional().describe(
        "If true, omit events the user already bet on. Needs API keys configured.",
      ),
      only_markets_i_follow: z.boolean().optional().describe(
        "If true, only events the user follows. Needs API keys configured.",
      ),
      limit: z.number().int().min(1).max(50).default(20).describe("Events per page, 1 to 50. Default 20."),
      offset: z.number().int().min(0).max(10000).default(0).describe(
        "Number of events to skip, for paging (use next_offset from the previous page). Default 0, maximum 10000.",
      ),
    },
    annotations: READ,
    handler: async (args) => {
      if (args.bet_end_date_after) requireTimezone("bet_end_date_after", args.bet_end_date_after);
      if (args.bet_end_date_before) requireTimezone("bet_end_date_before", args.bet_end_date_before);
      if (
        args.bet_end_date_after && args.bet_end_date_before &&
        Date.parse(args.bet_end_date_after) > Date.parse(args.bet_end_date_before)
      ) {
        throw new ToolInputError("bet_end_date_before must be later than bet_end_date_after.");
      }
      if ((args.hide_my_bets || args.only_markets_i_follow) && !hasKeys()) {
        throw new ToolInputError(
          "hide_my_bets and only_markets_i_follow need a user. Set FUTUUR_PUBLIC_KEY and FUTUUR_PRIVATE_KEY, or omit them.",
        );
      }

      const data = await futuur<Json>("events/", {
        query: {
          search: args.search,
          categories: args.categories,
          category_slug: args.category_slugs,
          tag: args.tags,
          live: args.status === "live" ? true : undefined,
          pending_resolution: args.status === "pending_resolution" ? true : undefined,
          resolved_only: args.status === "resolved" ? true : undefined,
          currency_mode: args.currency_mode,
          ordering: args.ordering,
          bet_end_date_after: args.bet_end_date_after,
          bet_end_date_before: args.bet_end_date_before,
          hide_my_bets: args.hide_my_bets ? true : undefined,
          only_markets_i_follow: args.only_markets_i_follow ? true : undefined,
          limit: args.limit,
          offset: args.offset > 0 ? args.offset : undefined,
        },
      });

      const results: Json[] = Array.isArray(data?.results) ? data.results : [];
      const total: number = data?.pagination?.total ?? results.length;
      const offset: number = data?.pagination?.offset ?? args.offset;
      const end = offset + results.length;
      return {
        total,
        returned: results.length,
        offset,
        next_offset: results.length > 0 && end < total ? end : null,
        events: results.map((event) => slimEvent(event, false)),
      };
    },
  }),

  defineTool({
    name: "get_market_details",
    title: "Get event details",
    description:
      "Returns one Futuur event with all its markets: the full description and resolution criteria, dates, " +
      "category, volumes and liquidity, and for each market its id, title, price (probability of the long " +
      "position, per currency), status, resolution, depth and last trade time. Takes an EVENT id (the `id` of an " +
      "item from get_markets); the market ids inside the result are what get_order_book and trading tools take. " +
      "Use it before trading to read the resolution rules, or to check the current state of one event.",
    input: {
      id: z.number().int().positive().describe(
        "Event id, as returned by get_markets. Not a market id.",
      ),
    },
    annotations: READ,
    handler: async (args) => {
      try {
        return slimEvent(await futuur<Json>(`events/${args.id}/`), true);
      } catch (error) {
        if (error instanceof FutuurApiError && error.status === 404) {
          throw new FutuurApiError(
            `No event with id ${args.id}. This tool takes an event id (from get_markets), not a market id.`,
            404,
            error.detail,
          );
        }
        throw error;
      }
    },
  }),

  defineTool({
    name: "get_price_history",
    title: "Get price history",
    description:
      "Returns how the prices of every market in an event changed over time, one series per market, for charting " +
      "or trend analysis. Each point has a UTC `time` and `price_percent`, the market's price as a percentage " +
      "from 0 to 100 (50 means 0.50). Takes an EVENT id, not a market id. Long series are thinned evenly (first " +
      "and last point kept) to `max_points` per series; `total_points` tells you how many existed.",
    input: {
      id: z.number().int().positive().describe("Event id, as returned by get_markets. Not a market id."),
      currency_mode: z.enum(CURRENCY_MODES).default("play_money").describe(
        "Which price history: \"play_money\" (default, OOM) or \"real_money\" (USDC/USDT).",
      ),
      time_interval: z.enum(["day", "week", "month", "year", "all_time"]).optional().describe(
        "Look-back window ending now: day (24 hours), week (7 days), month (31 days), year (365 days) or all_time. " +
          "Defaults to all_time.",
      ),
      max_points: z.number().int().min(2).max(2000).default(100).describe(
        "Maximum points returned per market series, 2 to 2000. Default 100.",
      ),
    },
    annotations: READ,
    handler: async (args) => {
      const series = await futuur<Json[]>(`events/${args.id}/price_history/`, {
        query: { currency_mode: args.currency_mode, time_interval: args.time_interval },
      });
      return {
        event_id: args.id,
        currency_mode: args.currency_mode,
        time_interval: args.time_interval ?? "all_time",
        series: (Array.isArray(series) ? series : []).map((s) => {
          const data: Json[] = Array.isArray(s.data) ? s.data : [];
          return {
            market: s.name,
            total_points: data.length,
            points: thin(data, args.max_points).map((p) => ({
              time: String(p.x).replace(/\.0$/, "Z"),
              price_percent: p.y,
            })),
          };
        }),
      };
    },
  }),

  defineTool({
    name: "get_order_book",
    title: "Get order book",
    description:
      "Returns the order book of one market: resting `bid` levels (best price first, highest) and `ask` levels " +
      "(best price first, lowest), each with the price (0 to 1), shares and amount at that level and the " +
      "cumulative totals from the best price, plus the last trade price/time and 24-hour volume and trade count. " +
      "Takes a MARKET id (an item of an event's `markets`), not an event id. Use it to judge liquidity and slippage " +
      "before placing an order; only the best `levels` levels per side are returned, with `*_levels_total` giving the full depth.",
    input: {
      id: z.number().int().positive().describe("Market id, from the `markets` of get_markets or get_market_details."),
      currency_mode: z.enum(CURRENCY_MODES).default("play_money").describe(
        "\"play_money\" (default, OOM) or \"real_money\" (USDC/USDT) book.",
      ),
      position: z.enum(["long", "short"]).default("long").describe(
        "Which side of the market to view: \"long\" (default) or \"short\". Short prices are 1 minus long prices.",
      ),
      levels: z.number().int().min(1).max(100).default(10).describe(
        "How many price levels to return per side, 1 to 100. Default 10.",
      ),
    },
    annotations: READ,
    handler: async (args) => {
      const book = await futuur<Json>(`markets/${args.id}/book/`, {
        query: { currency_mode: args.currency_mode, position: args.position },
      });
      const asks: Json[] = Array.isArray(book?.ask) ? book.ask : [];
      const bids: Json[] = Array.isArray(book?.bid) ? book.bid : [];
      const level = (l: Json) => ({
        price: l.price,
        shares: l.total_shares,
        amount: l.total_amount,
        cumulative_shares: l.cumulative_shares,
        cumulative_amount: l.cumulative_amount,
      });
      return {
        market_id: args.id,
        currency_mode: args.currency_mode,
        position: args.position,
        best_bid: bids[0]?.price ?? null,
        best_ask: asks[0]?.price ?? null,
        last_price: book?.last_price ?? null,
        last_trade_at: book?.last_trade_at ?? null,
        last_trade_taker_side: book?.last_trade_taker_side ?? null,
        volume_24h: book?.volume_24h,
        trades_24h: book?.trades_24h,
        bid_levels_total: bids.length,
        ask_levels_total: asks.length,
        bids: bids.slice(0, args.levels).map(level),
        asks: asks.slice(0, args.levels).map(level),
      };
    },
  }),

  defineTool({
    name: "get_categories",
    title: "List categories",
    description:
      "Lists Futuur's event categories so you can filter get_markets by category id or slug. A category belongs to " +
      "a tree (for example Politics > USA > 2028 Elections); filtering by a top-level category includes everything " +
      "below it. view=\"all\" (default) is the paginated list of categories that have open events, with their " +
      "full path, open event count and volume; view=\"root\" lists just the top-level categories; view=\"featured\" " +
      "is the 10 highest-volume categories. Use get_category_details for one category's subcategories.",
    input: {
      view: z.enum(["all", "root", "featured"]).default("all").describe(
        "\"all\" (default): paginated list of every category with open events, A to Z. \"root\": top-level " +
          "categories only. \"featured\": top 10 by volume.",
      ),
      search: z.string().min(1).optional().describe(
        "Case-insensitive text to match in category titles. Only with view \"all\" or \"featured\".",
      ),
      currency_mode: z.enum(CURRENCY_MODES).optional().describe(
        "Count open events and rank volume for \"play_money\" or \"real_money\". Omit for play money counts.",
      ),
      limit: z.number().int().min(1).max(200).default(100).describe(
        "Categories per page, 1 to 200. Default 100. Only with view \"all\".",
      ),
      offset: z.number().int().min(0).max(10000).default(0).describe(
        "Number of categories to skip, for paging. Default 0. Only with view \"all\".",
      ),
    },
    annotations: READ,
    handler: async (args) => {
      if (args.search && args.view === "root") {
        throw new ToolInputError("search works with view \"all\" or \"featured\", not \"root\".");
      }
      if (args.view !== "all" && args.offset > 0) {
        throw new ToolInputError("offset only applies to view \"all\".");
      }

      if (args.view === "all") {
        const data = await futuur<Json>("categories/", {
          query: {
            search: args.search,
            currency_mode: args.currency_mode,
            limit: args.limit,
            offset: args.offset > 0 ? args.offset : undefined,
          },
        });
        const results: Json[] = Array.isArray(data?.results) ? data.results : [];
        const total: number = data?.pagination?.total ?? results.length;
        const offset: number = data?.pagination?.offset ?? args.offset;
        const end = offset + results.length;
        return {
          total,
          returned: results.length,
          offset,
          next_offset: results.length > 0 && end < total ? end : null,
          categories: results.map(slimCategory),
        };
      }

      const path = args.view === "root" ? "categories/root/" : "categories/featured/";
      const data = await futuur<Json[]>(path, {
        query: { search: args.view === "featured" ? args.search : undefined, currency_mode: args.currency_mode },
      });
      const list = Array.isArray(data) ? data : [];
      return { returned: list.length, categories: list.map(slimCategory) };
    },
  }),

  defineTool({
    name: "get_category_details",
    title: "Get category details",
    description:
      "Returns one category: its title, slug, parent, full path from the top-level category, whether it has " +
      "subcategories and their ids and titles, how many events are open in it and its trading volume. Use it to " +
      "walk down the category tree; pass a category id (or a child's id) to get_markets `categories` to list " +
      "its events. Category ids come from get_categories or from an event's `category`.",
    input: {
      id: z.number().int().positive().describe("Category id, from get_categories or get_markets."),
      currency_mode: z.enum(CURRENCY_MODES).optional().describe(
        "Count open events (and children with open events) for \"play_money\" or \"real_money\". Omit for play money.",
      ),
    },
    annotations: READ,
    handler: async (args) => {
      try {
        const category = await futuur<Json>(`categories/${args.id}/`, { query: { currency_mode: args.currency_mode } });
        return {
          ...slimCategory(category),
          has_children: category.has_children,
          children: Array.isArray(category.children)
            ? category.children.map((c: Json) => ({ id: c.id, title: c.title, slug: c.slug }))
            : [],
        };
      } catch (error) {
        if (error instanceof FutuurApiError && error.status === 404) {
          throw new FutuurApiError(`No category with id ${args.id}. Use get_categories to find valid ids.`, 404, error.detail);
        }
        throw error;
      }
    },
  }),

  defineTool({
    name: "get_exchange_rates",
    title: "Get exchange rates",
    description:
      "Returns Futuur's latest currency exchange rates. Each entry is a base currency (USD, EUR, BTC, USDC, USDT) " +
      "with `rates`: how many units of every quoted currency (BCH, BNB, BRL, BTC, ETH, EUR, LTC, MXN, SOL, TRX, USD, " +
      "XMR, BUSD, DOGE, USDC, USDT) one unit of the base is worth, and the time of the last update. Play money " +
      "(OOM) has no rate. Pass `base_currency` to get one base only; use convert_to_usd or convert_from_usd to " +
      "convert an amount.",
    input: {
      base_currency: z.string().min(2).max(10).optional().describe(
        "Return only this base currency's rates: USD, EUR, BTC, USDC or USDT (case-insensitive). Omit for all bases.",
      ),
    },
    annotations: READ,
    handler: async (args) => {
      const rates = await loadRates();
      if (!args.base_currency) return rates;
      const base = args.base_currency.trim().toUpperCase();
      const table = rates[base];
      if (!table) {
        throw new ToolInputError(`No rate table for base currency "${args.base_currency}". Bases: ${Object.keys(rates).join(", ")}.`);
      }
      return { [base]: table };
    },
  }),

  defineTool({
    name: "convert_to_usd",
    title: "Convert amount to USD",
    description:
      "Calculates what an amount in another currency is worth in USD at Futuur's latest exchange rates. It only " +
      "calculates; nothing is exchanged and no balance changes. Use it to show a USD equivalent for a balance or " +
      "a stake in USDC, USDT, EUR, BTC, ETH and other quoted currencies (see get_exchange_rates for the list). " +
      "Play money (OOM) has no USD value. Returns the converted amount, the USD rate used and when the rates were updated.",
    input: {
      value: z.number().positive().describe("Amount of the source currency to convert, greater than 0."),
      from_currency: z.string().min(2).max(10).describe("Source currency code, e.g. \"BTC\", \"USDC\" or \"EUR\"."),
    },
    annotations: READ,
    handler: async (args) => {
      const rates = await loadRates();
      const { value: usdPer, updated } = usdPerUnit(rates, args.from_currency);
      return {
        from_currency: args.from_currency.trim().toUpperCase(),
        to_currency: "USD",
        amount: args.value,
        converted: roundSig(args.value * usdPer),
        rate: roundSig(usdPer),
        rates_updated_at: updated ?? null,
        note: "Indicative; calculated from Futuur's latest exchange rates, not an executed conversion.",
      };
    },
  }),

  defineTool({
    name: "convert_from_usd",
    title: "Convert USD to another currency",
    description:
      "Calculates how much of another currency a USD amount buys at Futuur's latest exchange rates. It only " +
      "calculates; nothing is exchanged and no balance changes. Use it to express a USD amount in USDC, USDT, EUR, " +
      "BTC, ETH and other quoted currencies (see get_exchange_rates for the list). Play money (OOM) has no USD " +
      "rate. Returns the converted amount, the rate used (units of the target currency per 1 USD) and when the rates were updated.",
    input: {
      value: z.number().positive().describe("Amount in USD to convert, greater than 0."),
      to_currency: z.string().min(2).max(10).describe("Target currency code, e.g. \"BTC\", \"USDC\" or \"EUR\"."),
    },
    annotations: READ,
    handler: async (args) => {
      const rates = await loadRates();
      const { value: usdPer, updated } = usdPerUnit(rates, args.to_currency);
      return {
        from_currency: "USD",
        to_currency: args.to_currency.trim().toUpperCase(),
        amount: args.value,
        converted: roundSig(args.value / usdPer),
        rate: roundSig(1 / usdPer),
        rates_updated_at: updated ?? null,
        note: "Indicative; calculated from Futuur's latest exchange rates, not an executed conversion.",
      };
    },
  }),
];

/** Evenly thin `items` to at most `max` entries, always keeping the first and the last. */
export function thin<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.round((i * (items.length - 1)) / (max - 1))]);
  return out;
}

function slimCategory(category: Json): Json {
  return {
    id: category.id,
    title: category.title,
    slug: category.slug,
    parent_id: category.parent ?? null,
    path: categoryPath(category.tree) ?? category.title,
    open_events_count: category.open_events_count,
    volume_play_money: category.volume_play_money,
    volume_real_money: category.volume_real_money,
  };
}
