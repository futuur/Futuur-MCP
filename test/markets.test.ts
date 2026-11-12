import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { runTool, type ToolDef } from "../src/tool.js";
import { htmlToText, marketTools, thin } from "../src/tools/markets.js";

const BASE = "https://api.futuur.com/v2.0/";

function tool(name: string): ToolDef<any> {
  const def = marketTools.find((t) => t.name === name);
  if (!def) throw new Error(`no tool ${name}`);
  return def;
}

/** Runs a tool like the server does: validate and apply defaults first, then call the handler. */
async function run(name: string, args: Record<string, unknown> = {}) {
  const def = tool(name);
  const parsed = z.object(def.input).parse(args);
  return runTool(def, parsed);
}

// --- Realistic fixtures: trimmed copies of production responses (2026-11-12) -----------------

const MARKET_BTC = {
  id: 607897,
  title: "Bitcoin Price up or down today: $74,281.88",
  title_verbose: "Bitcoin Price up or down today: $74,281.88 - Bitcoin Price up or down today: $74,281.88",
  price: { OOM: 0.04, USDC: 0.03 },
  long_label: "Up",
  short_label: "Down",
  status: "active",
  resolution: "-",
  resolution_display: null,
  position_labels: "updown",
  long_thumbnail: null,
  short_thumbnail: null,
  volume_play_money: 212677.92,
  volume_real_money: 4274.72083386,
  liquidity_play_money: 292937.48,
  liquidity_real_money: 5857.29,
  depth_play_money: 14049.97,
  depth_real_money: 281.12,
  thumbnail: "https://futuur-media-production.s3.amazonaws.com/cache/7d/34/7d340e61e95a5ad7c4715d19aea282f3.webp",
  order: 10,
  last_trade_at_play_money: "2026-11-12T15:28:28.278125Z",
  last_trade_at_real_money: "2026-11-12T15:25:54.686367Z",
  volume_24h_play_money: 212677.92,
  volume_24h_real_money: 4274.72,
};

const EVENT_BTC = {
  id: 250619,
  title: "Bitcoin Price up or down today: $74,281.88",
  slug: "bitcoin-price-up-or-down-today-7428188",
  status: "open",
  tags: [{ name: "Bitcoin", slug: "bitcoin" }, { name: "Crypto", slug: "crypto" }],
  bet_end_date: "2026-11-12T17:00:00Z",
  event_start_date: "2026-11-11T17:00:00Z",
  event_end_date: "2026-11-12T17:00:00Z",
  is_wagerable: true,
  available_currencies: ["OOM", "USDC"],
  resolution: null,
  resolve_date: null,
  real_currency_available: true,
  markets_correlation: "independent",
  canonical_currency: "USDC",
  order_book_enabled: true,
  thumbnail: null,
  tax_play_money: null,
  tax_real_money: null,
  resolution_mode: "non_exclusive",
  event_type: null,
  is_live: true,
  wagers_count_play_money: 15,
  wagers_count_real_money: 16,
  comment_count: 0,
  volume_play_money: 324212.60483607,
  volume_real_money: 6260.4487064,
  liquidity_play_money: 292937.48,
  liquidity_real_money: 5857.29,
  is_following: false,
  wagers: null,
  category: [
    { id: 3727, title: "Crypto Prices", slug: "crypto-prices", parent: null, in_leaderboard: true, icon: null },
    { id: 3689, title: "Bitcoin Daily", slug: "bitcoin-daily", parent: 3727, in_leaderboard: false, icon: null },
  ],
  markets: [MARKET_BTC],
  relevance: 0.9439,
  hot: false,
  is_pinned: false,
  is_new: true,
  event_extra_data: { pair: "BTCUSDT", frequency: "daily", timeframe: "24" },
};

const EVENTS_PAGE = {
  pagination: {
    total: 13,
    next: "http://api.futuur.com/v2.0/events/?limit=1&offset=1&search=bitcoin",
    previous: null,
    page_size: 1,
    offset: 0,
  },
  results: [EVENT_BTC],
};

const RESOLVED_MARKET = {
  ...MARKET_BTC,
  id: 608020,
  title: "Bitcoin Up or Down: Price to beat $72,503.34 - 1 hr",
  status: "resolved",
  resolution: "Down",
  resolution_display: "Down",
};

const EVENT_DETAIL = {
  ...EVENT_BTC,
  transactions_count: 612,
  transactions_count_canonical: 100,
  cancellation_reason: null,
  description:
    "<b>Resolution Criteria</b><br/>This market resolves to \"Up\" if the close is greater than or equal to the prior close.<br/><br/><b>Notes</b><br/>- Only Binance BTC/USDT data counts &amp; nothing else.",
  time_interval: { day: true, week: false, month: false, year: false, all_time: true },
  suggested_by: null,
  is_real_money_bets_forbidden: false,
  brier_score_real_money: null,
  brier_score_play_money: null,
  markets: [{ ...MARKET_BTC, description: null, resolution_description: "<p>Resolved by Binance.</p>" }],
};

const PRICE_HISTORY = [
  {
    name: "Bitcoin Price up or down today: $74,281.88",
    data: [
      { x: "2026-11-11T17:01:07.0", y: 50 },
      { x: "2026-11-11T17:16:42.0", y: 55 },
      { x: "2026-11-11T17:19:11.0", y: 59 },
      { x: "2026-11-11T17:19:25.0", y: 61 },
      { x: "2026-11-12T15:28:31.0", y: 4 },
    ],
  },
];

const CATEGORY_ROOT = { id: 3727, title: "Crypto Prices", slug: "crypto-prices", parent: null, in_leaderboard: true, icon: null };
const CATEGORY_CHILD = { id: 3689, title: "Bitcoin Daily", slug: "bitcoin-daily", parent: 3727, in_leaderboard: false, icon: null };
const CATEGORY_LIST_ITEM = {
  id: 2197,
  title: "007",
  slug: "007",
  parent: 581,
  in_leaderboard: false,
  icon: null,
  tree: [
    { id: 555, title: "Entertainment", slug: "entertainment", parent: null, in_leaderboard: true, icon: null },
    { id: 581, title: "Movies", slug: "movies", parent: 555, in_leaderboard: false, icon: null },
    { id: 2197, title: "007", slug: "007", parent: 581, in_leaderboard: false, icon: null },
  ],
  volume_play_money: 4461618.22245871,
  volume_real_money: 7226.72531363,
  open_events_count: 7,
};
const CATEGORY_DETAIL = {
  ...CATEGORY_ROOT,
  tree: [CATEGORY_ROOT],
  volume_play_money: 0,
  volume_real_money: 0,
  open_events_count: 2,
  children: [CATEGORY_CHILD, { id: 3702, title: "Bitcoin Hourly", slug: "bitcoin-hourly", parent: 3727, in_leaderboard: false, icon: null }],
  seo: { seo_title_en: "Crypto Prices Forecasts and Predictions | Futuur", seo_image: null },
  has_children: true,
};

const BOOK = {
  ask: [
    { price: 0.05, total_shares: 5719.1, total_amount: 285.96, total_fees: 0, cumulative_shares: 5719.1, cumulative_amount: 285.96, cumulative_fees: 0 },
    { price: 0.06, total_shares: 5923.97, total_amount: 355.44, total_fees: 0, cumulative_shares: 11643.07, cumulative_amount: 641.39, cumulative_fees: 0 },
    { price: 0.07, total_shares: 100, total_amount: 7, total_fees: 0, cumulative_shares: 11743.07, cumulative_amount: 648.39, cumulative_fees: 0 },
  ],
  bid: [
    { price: 0.03, total_shares: 8939.42, total_amount: 268.18, total_fees: 0, cumulative_shares: 8939.42, cumulative_amount: 268.18, cumulative_fees: 0 },
    { price: 0.02, total_shares: 13241.24, total_amount: 264.82, total_fees: 0, cumulative_shares: 22180.66, cumulative_amount: 533.01, cumulative_fees: 0 },
  ],
  last_price: 0.05,
  last_trade_at: "2026-11-12T15:28:28.278125Z",
  last_trade_taker_side: "bid",
  volume_24h: 212677.92,
  trades_24h: 306,
};

const RATES = {
  USD: {
    rates: { BRL: 5.606, BTC: 1.353e-5, ETH: 0.0004868, EUR: 0.9016, USD: 1, USDC: 1, USDT: 1.001 },
    last_update: "2026-11-12T00:00:00.533356Z",
    update_code: "d430b28b-6d5e-4a40-8",
  },
  BTC: {
    rates: { BRL: 414441.26, BTC: 1, ETH: 35.99, EUR: 66656.22, USD: 73932.48, USDC: 73943.22, USDT: 74010.86 },
    last_update: "2026-11-12T00:00:00.739355Z",
    update_code: "d430b28b-6d5e-4a40-8",
  },
  USDC: {
    rates: { BRL: 5.605, BTC: 1.352e-5, ETH: 0.0004868, EUR: 0.9013, USD: 0.9998, USDC: 1, USDT: 1.001 },
    last_update: "2026-11-12T00:00:00.877304Z",
    update_code: "d430b28b-6d5e-4a40-8",
  },
};

// ---------------------------------------------------------------------------------------------

const fetchMock = vi.fn();

function respond(data: unknown, status = 200) {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(data), { status }));
}
const lastUrl = () => String(fetchMock.mock.calls.at(-1)![0]);
const lastInit = () => fetchMock.mock.calls.at(-1)![1] as RequestInit & { headers: Record<string, string> };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("FUTUUR_PUBLIC_KEY", "");
  vi.stubEnv("FUTUUR_PRIVATE_KEY", "");
  vi.stubEnv("FUTUUR_API_BASE_URL", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe("tool catalogue", () => {
  it("exposes the expected read-only tools", () => {
    expect(marketTools.map((t) => t.name)).toEqual([
      "get_markets", "get_market_details", "get_price_history", "get_order_book",
      "get_categories", "get_category_details", "get_exchange_rates", "convert_to_usd", "convert_from_usd",
    ]);
    for (const t of marketTools) {
      expect(t.annotations.readOnlyHint).toBe(true);
      for (const [field, schema] of Object.entries(t.input)) {
        expect((schema as z.ZodType).description, `${t.name}.${field}`).toBeTruthy();
      }
    }
  });
});

describe("get_markets", () => {
  it("lists events with the default filters, anonymously, and slims the payload", async () => {
    respond(EVENTS_PAGE);
    const result = await run("get_markets", { search: "bitcoin", limit: 1 });
    expect(result.isError).toBeUndefined();
    expect(lastUrl()).toBe(`${BASE}events/?search=bitcoin&currency_mode=play_money&limit=1`);
    expect(lastInit().method).toBe("GET");
    expect(lastInit().headers.HMAC).toBeUndefined();

    expect(result.structuredContent).toEqual({
      total: 13,
      returned: 1,
      offset: 0,
      next_offset: 1,
      events: [
        {
          id: 250619,
          title: "Bitcoin Price up or down today: $74,281.88",
          slug: "bitcoin-price-up-or-down-today-7428188",
          status: "open",
          is_wagerable: true,
          bet_end_date: "2026-11-12T17:00:00Z",
          event_start_date: "2026-11-11T17:00:00Z",
          event_end_date: "2026-11-12T17:00:00Z",
          resolve_date: null,
          category: { id: 3689, title: "Bitcoin Daily", slug: "bitcoin-daily", path: "Crypto Prices > Bitcoin Daily" },
          tags: ["bitcoin", "crypto"],
          available_currencies: ["OOM", "USDC"],
          markets_correlation: "independent",
          resolution_mode: "non_exclusive",
          order_book_enabled: true,
          volume_play_money: 324212.60483607,
          volume_real_money: 6260.4487064,
          wagers_count_play_money: 15,
          wagers_count_real_money: 16,
          markets: [
            {
              id: 607897,
              title: "Bitcoin Price up or down today: $74,281.88",
              price: { OOM: 0.04, USDC: 0.03 },
              long_label: "Up",
              short_label: "Down",
              status: "active",
              resolution: null,
              volume_play_money: 212677.92,
              volume_real_money: 4274.72083386,
            },
          ],
        },
      ],
    });
    const text = JSON.stringify(result.structuredContent);
    expect(text).not.toContain("thumbnail");
    expect(text).not.toContain("relevance");
  });

  it("sends every filter with the production parameter names", async () => {
    respond({ pagination: { total: 0, next: null, previous: null, page_size: 5, offset: 5 }, results: [] });
    const result = await run("get_markets", {
      search: "bitcoin",
      categories: [3727, 98],
      category_slugs: ["crypto-prices"],
      tags: ["bitcoin", "crypto"],
      status: "pending_resolution",
      currency_mode: "real_money",
      ordering: "-volume",
      bet_end_date_after: "2026-11-13T00:00:00Z",
      bet_end_date_before: "2026-12-01T00:00:00+00:00",
      limit: 5,
      offset: 5,
    });
    const url = new URL(lastUrl());
    expect(url.origin + url.pathname).toBe(`${BASE}events/`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: "bitcoin",
      categories: "3727,98",
      category_slug: "crypto-prices",
      tag: "bitcoin,crypto",
      pending_resolution: "true",
      currency_mode: "real_money",
      ordering: "-volume",
      bet_end_date_after: "2026-11-13T00:00:00Z",
      bet_end_date_before: "2026-12-01T00:00:00+00:00",
      limit: "5",
      offset: "5",
    });
    expect(result.structuredContent).toEqual({ total: 0, returned: 0, offset: 5, next_offset: null, events: [] });
  });

  it.each([
    ["live", "live"],
    ["resolved", "resolved_only"],
  ])("maps status %s to the %s flag", async (status, flag) => {
    respond({ pagination: { total: 0, next: null, previous: null, page_size: 20, offset: 0 }, results: [] });
    await run("get_markets", { status });
    expect(new URL(lastUrl()).searchParams.get(flag)).toBe("true");
  });

  it("reports resolved markets and a null next_offset on the last page", async () => {
    respond({
      pagination: { total: 21, next: null, previous: "x", page_size: 20, offset: 20 },
      results: [{ ...EVENT_BTC, status: "resolved", markets: [RESOLVED_MARKET] }],
    });
    const result = await run("get_markets", { status: "resolved", offset: 20 });
    const sc = result.structuredContent as any;
    expect(sc.next_offset).toBeNull();
    expect(sc.events[0].status).toBe("resolved");
    expect(sc.events[0].markets[0].resolution).toBe("Down");
  });

  it("sends the user filters only when keys are configured", async () => {
    respond({ pagination: { total: 0, next: null, previous: null, page_size: 20, offset: 0 }, results: [] });
    const refused = await run("get_markets", { hide_my_bets: true });
    expect(refused.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("FUTUUR_PUBLIC_KEY", "pub");
    vi.stubEnv("FUTUUR_PRIVATE_KEY", "secret");
    await run("get_markets", { hide_my_bets: true, only_markets_i_follow: true });
    const params = new URL(lastUrl()).searchParams;
    expect(params.get("hide_my_bets")).toBe("true");
    expect(params.get("only_markets_i_follow")).toBe("true");
    expect(lastInit().headers.Key).toBe("pub");
  });

  it("rejects bad dates and inverted ranges as input errors, without calling the API", async () => {
    const naive = await run("get_markets", { bet_end_date_after: "2026-11-13" });
    expect(naive).toMatchObject({ isError: true });
    expect((naive.content[0] as any).text).toContain("timezone");
    const inverted = await run("get_markets", {
      bet_end_date_after: "2026-12-01T00:00:00Z",
      bet_end_date_before: "2026-11-01T00:00:00Z",
    });
    expect(inverted.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects values outside the production enums at the schema", () => {
    const shape = z.object(tool("get_markets").input);
    expect(shape.safeParse({ ordering: "bogus" }).success).toBe(false);
    expect(shape.safeParse({ status: "closed" }).success).toBe(false);
    expect(shape.safeParse({ limit: 500 }).success).toBe(false);
    expect(shape.safeParse({ tags: Array(11).fill("x") }).success).toBe(false);
  });

  it("surfaces an API error as an error result", async () => {
    respond({ type: "validation_error", errors: [{ code: "invalid_choice", detail: "bad ordering", attr: "ordering" }] }, 400);
    const result = await run("get_markets", {});
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain("400");
  });
});

describe("get_market_details", () => {
  it("fetches the event and returns description text and detailed markets", async () => {
    respond(EVENT_DETAIL);
    const result = await run("get_market_details", { id: 250619 });
    expect(lastUrl()).toBe(`${BASE}events/250619/`);
    const sc = result.structuredContent as any;
    expect(sc.id).toBe(250619);
    expect(sc.description).toBe(
      "Resolution Criteria\nThis market resolves to \"Up\" if the close is greater than or equal to the prior close.\n\nNotes\n- Only Binance BTC/USDT data counts & nothing else.",
    );
    expect(sc.liquidity_real_money).toBe(5857.29);
    expect(sc.event_extra_data).toEqual({ pair: "BTCUSDT", frequency: "daily", timeframe: "24" });
    expect(sc.markets[0]).toEqual({
      id: 607897,
      title: "Bitcoin Price up or down today: $74,281.88",
      price: { OOM: 0.04, USDC: 0.03 },
      long_label: "Up",
      short_label: "Down",
      status: "active",
      resolution: null,
      volume_play_money: 212677.92,
      volume_real_money: 4274.72083386,
      liquidity_play_money: 292937.48,
      liquidity_real_money: 5857.29,
      depth_play_money: 14049.97,
      depth_real_money: 281.12,
      volume_24h_play_money: 212677.92,
      volume_24h_real_money: 4274.72,
      last_trade_at_play_money: "2026-11-12T15:28:28.278125Z",
      last_trade_at_real_money: "2026-11-12T15:25:54.686367Z",
      description: null,
      resolution_description: "Resolved by Binance.",
    });
  });

  it("explains a 404 as a wrong id kind", async () => {
    respond({ type: "client_error", errors: [{ code: "not_found", detail: "Not found." }] }, 404);
    const result = await run("get_market_details", { id: 607897 });
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain("event id");
  });
});

describe("get_price_history", () => {
  it("requests the event price history and renames the points", async () => {
    respond(PRICE_HISTORY);
    const result = await run("get_price_history", { id: 250619, currency_mode: "real_money", time_interval: "day" });
    expect(lastUrl()).toBe(`${BASE}events/250619/price_history/?currency_mode=real_money&time_interval=day`);
    expect(result.structuredContent).toEqual({
      event_id: 250619,
      currency_mode: "real_money",
      time_interval: "day",
      series: [
        {
          market: "Bitcoin Price up or down today: $74,281.88",
          total_points: 5,
          points: [
            { time: "2026-11-11T17:01:07Z", price_percent: 50 },
            { time: "2026-11-11T17:16:42Z", price_percent: 55 },
            { time: "2026-11-11T17:19:11Z", price_percent: 59 },
            { time: "2026-11-11T17:19:25Z", price_percent: 61 },
            { time: "2026-11-12T15:28:31Z", price_percent: 4 },
          ],
        },
      ],
    });
  });

  it("defaults to play money, omits time_interval and thins long series keeping the ends", async () => {
    respond(PRICE_HISTORY);
    const result = await run("get_price_history", { id: 250619, max_points: 3 });
    expect(lastUrl()).toBe(`${BASE}events/250619/price_history/?currency_mode=play_money`);
    const sc = result.structuredContent as any;
    expect(sc.time_interval).toBe("all_time");
    expect(sc.series[0].total_points).toBe(5);
    expect(sc.series[0].points.map((p: any) => p.price_percent)).toEqual([50, 59, 4]);
  });

  it("thin keeps first and last and passes short lists through", () => {
    expect(thin([1, 2, 3], 5)).toEqual([1, 2, 3]);
    const long = Array.from({ length: 1000 }, (_, i) => i);
    const out = thin(long, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(999);
  });
});

describe("get_order_book", () => {
  it("requests the market book and keeps the top levels", async () => {
    respond(BOOK);
    const result = await run("get_order_book", { id: 607897, currency_mode: "real_money", position: "short", levels: 2 });
    expect(lastUrl()).toBe(`${BASE}markets/607897/book/?currency_mode=real_money&position=short`);
    expect(lastInit().headers.HMAC).toBeUndefined();
    expect(result.structuredContent).toEqual({
      market_id: 607897,
      currency_mode: "real_money",
      position: "short",
      best_bid: 0.03,
      best_ask: 0.05,
      last_price: 0.05,
      last_trade_at: "2026-11-12T15:28:28.278125Z",
      last_trade_taker_side: "bid",
      volume_24h: 212677.92,
      trades_24h: 306,
      bid_levels_total: 2,
      ask_levels_total: 3,
      bids: [
        { price: 0.03, shares: 8939.42, amount: 268.18, cumulative_shares: 8939.42, cumulative_amount: 268.18 },
        { price: 0.02, shares: 13241.24, amount: 264.82, cumulative_shares: 22180.66, cumulative_amount: 533.01 },
      ],
      asks: [
        { price: 0.05, shares: 5719.1, amount: 285.96, cumulative_shares: 5719.1, cumulative_amount: 285.96 },
        { price: 0.06, shares: 5923.97, amount: 355.44, cumulative_shares: 11643.07, cumulative_amount: 641.39 },
      ],
    });
  });

  it("defaults to the play-money long book and handles an empty book", async () => {
    respond({ ask: [], bid: [], last_price: null, last_trade_at: null, last_trade_taker_side: null, volume_24h: 0, trades_24h: 0 });
    const result = await run("get_order_book", { id: 1 });
    expect(lastUrl()).toBe(`${BASE}markets/1/book/?currency_mode=play_money&position=long`);
    const sc = result.structuredContent as any;
    expect(sc.best_bid).toBeNull();
    expect(sc.best_ask).toBeNull();
    expect(sc.bids).toEqual([]);
  });
});

describe("get_categories", () => {
  it("lists all categories, paginated, with the path", async () => {
    respond({
      pagination: { total: 184, next: "http://api.futuur.com/v2.0/categories/?limit=1&offset=1", previous: null, page_size: 1, offset: 0 },
      results: [CATEGORY_LIST_ITEM],
    });
    const result = await run("get_categories", { search: "007", currency_mode: "real_money", limit: 1 });
    expect(lastUrl()).toBe(`${BASE}categories/?search=007&currency_mode=real_money&limit=1`);
    expect(result.structuredContent).toEqual({
      total: 184,
      returned: 1,
      offset: 0,
      next_offset: 1,
      categories: [
        {
          id: 2197,
          title: "007",
          slug: "007",
          parent_id: 581,
          path: "Entertainment > Movies > 007",
          open_events_count: 7,
          volume_play_money: 4461618.22245871,
          volume_real_money: 7226.72531363,
        },
      ],
    });
  });

  it("lists the root categories", async () => {
    respond([CATEGORY_ROOT]);
    const result = await run("get_categories", { view: "root", currency_mode: "play_money" });
    expect(lastUrl()).toBe(`${BASE}categories/root/?currency_mode=play_money`);
    expect(result.structuredContent).toEqual({
      returned: 1,
      categories: [{ id: 3727, title: "Crypto Prices", slug: "crypto-prices", parent_id: null, path: "Crypto Prices" }],
    });
  });

  it("lists featured categories and passes search", async () => {
    respond([CATEGORY_LIST_ITEM]);
    await run("get_categories", { view: "featured", search: "movies" });
    expect(lastUrl()).toBe(`${BASE}categories/featured/?search=movies`);
  });

  it("rejects parameters the chosen view does not support", async () => {
    expect((await run("get_categories", { view: "root", search: "x" })).isError).toBe(true);
    expect((await run("get_categories", { view: "featured", offset: 10 })).isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("get_category_details", () => {
  it("returns the category with its children and drops SEO data", async () => {
    respond(CATEGORY_DETAIL);
    const result = await run("get_category_details", { id: 3727, currency_mode: "real_money" });
    expect(lastUrl()).toBe(`${BASE}categories/3727/?currency_mode=real_money`);
    expect(result.structuredContent).toEqual({
      id: 3727,
      title: "Crypto Prices",
      slug: "crypto-prices",
      parent_id: null,
      path: "Crypto Prices",
      open_events_count: 2,
      volume_play_money: 0,
      volume_real_money: 0,
      has_children: true,
      children: [
        { id: 3689, title: "Bitcoin Daily", slug: "bitcoin-daily" },
        { id: 3702, title: "Bitcoin Hourly", slug: "bitcoin-hourly" },
      ],
    });
  });

  it("reports an unknown category clearly", async () => {
    respond({ type: "client_error", errors: [{ code: "not_found", detail: "Not found." }] }, 404);
    const result = await run("get_category_details", { id: 999999 });
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain("get_categories");
  });
});

describe("exchange rates and conversion", () => {
  it("returns all rate tables from exchange_rates/latest/", async () => {
    respond(RATES);
    const result = await run("get_exchange_rates");
    expect(lastUrl()).toBe(`${BASE}exchange_rates/latest/`);
    expect(result.structuredContent).toEqual(RATES);
  });

  it("filters to one base, case-insensitively, and rejects an unknown base", async () => {
    respond(RATES);
    const one = await run("get_exchange_rates", { base_currency: "btc" });
    expect(Object.keys(one.structuredContent as object)).toEqual(["BTC"]);
    const bad = await run("get_exchange_rates", { base_currency: "XYZ" });
    expect(bad.isError).toBe(true);
    expect((bad.content[0] as any).text).toContain("USD, BTC, USDC");
  });

  it("converts to USD using the source currency's own USD rate", async () => {
    respond(RATES);
    const result = await run("convert_to_usd", { value: 0.01, from_currency: "btc" });
    expect(lastUrl()).toBe(`${BASE}exchange_rates/latest/`);
    expect(result.structuredContent).toMatchObject({
      from_currency: "BTC",
      to_currency: "USD",
      amount: 0.01,
      converted: 739.3248,
      rate: 73932.48,
      rates_updated_at: "2026-11-12T00:00:00.739355Z",
    });
  });

  it("converts a currency without its own table through the USD table", async () => {
    respond(RATES);
    const result = await run("convert_to_usd", { value: 560.6, from_currency: "BRL" });
    const sc = result.structuredContent as any;
    expect(sc).toMatchObject({ from_currency: "BRL", converted: 100 });
    expect(sc.rate).toBeCloseTo(1 / 5.606, 6);
  });

  it("converts USD to another currency", async () => {
    respond(RATES);
    const btc = await run("convert_from_usd", { value: 739.3248, to_currency: "BTC" });
    expect(btc.structuredContent).toMatchObject({ from_currency: "USD", to_currency: "BTC", converted: 0.01 });
    expect((btc.structuredContent as any).rate).toBeCloseTo(1 / 73932.48, 10);
    const usd = await run("convert_from_usd", { value: 5, to_currency: "USD" });
    expect(usd.structuredContent).toMatchObject({ converted: 5, rate: 1 });
  });

  it("refuses OOM and unknown currencies as input errors", async () => {
    respond(RATES);
    const oom = await run("convert_to_usd", { value: 10, from_currency: "OOM" });
    expect(oom.isError).toBe(true);
    expect((oom.content[0] as any).text).toContain("play-money");
    const unknown = await run("convert_from_usd", { value: 10, to_currency: "ZZZ" });
    expect(unknown.isError).toBe(true);
    expect((unknown.content[0] as any).text).toContain("Unsupported currency");
  });

  it("rejects non-positive amounts at the schema", () => {
    expect(z.object(tool("convert_to_usd").input).safeParse({ value: 0, from_currency: "BTC" }).success).toBe(false);
  });
});

describe("htmlToText", () => {
  it("turns authored HTML into plain text", () => {
    expect(htmlToText("<p>a &amp; b</p><p>c<br/>d</p>")).toBe("a & b\nc\nd");
    expect(htmlToText("")).toBeNull();
    expect(htmlToText(null)).toBeNull();
  });
});
