import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { runTool } from "../src/tool.js";
import { tradingTools } from "../src/tools/trading.js";

const tool = (name: string) => {
  const found = tradingTools.find((t) => t.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
};

// Levels copied from a live response of
//   GET https://api.futuur.com/v2.0/markets/607897/book/?currency_mode=real_money&position=long
// (top of the ask side, whole bid side). total_amount includes taker fees; cumulative_* omitted as unused.
const REAL_LONG_BOOK = {
  ask: [
    { price: 0.04, total_shares: 141.48, total_amount: 5.93, total_fees: 0.27, cumulative_shares: 141.48, cumulative_amount: 5.93, cumulative_fees: 0.27 },
    { price: 0.05, total_shares: 143.12, total_amount: 7.5, total_fees: 0.34, cumulative_shares: 284.6, cumulative_amount: 13.43, cumulative_fees: 0.61 },
    { price: 0.06, total_shares: 118.52, total_amount: 7.45, total_fees: 0.33, cumulative_shares: 403.12, cumulative_amount: 20.87, cumulative_fees: 0.95 },
    { price: 0.07, total_shares: 101.52, total_amount: 7.44, total_fees: 0.33, cumulative_shares: 504.64, cumulative_amount: 28.31, cumulative_fees: 1.28 },
  ],
  bid: [
    { price: 0.02, total_shares: 174.79, total_amount: 3.32, total_fees: 0.17, cumulative_shares: 174.79, cumulative_amount: 3.32, cumulative_fees: 0.17 },
    { price: 0.01, total_shares: 449.9, total_amount: 4.28, total_fees: 0.22, cumulative_shares: 624.69, cumulative_amount: 7.6, cumulative_fees: 0.39 },
  ],
  last_price: 0.02,
  last_trade_at: "2026-11-12T15:36:53.579731Z",
  last_trade_taker_side: "ask",
  volume_24h: 4274.74,
  trades_24h: 286,
};

// Same market, play money, position=short: top of the bid side and the whole ask side (no fees in play money).
const PLAY_SHORT_BOOK = {
  ask: [
    { price: 0.97, total_shares: 8939.42, total_amount: 8671.24, total_fees: 0.0, cumulative_shares: 8939.42, cumulative_amount: 8671.24, cumulative_fees: 0.0 },
    { price: 0.98, total_shares: 13241.24, total_amount: 12976.42, total_fees: 0.0, cumulative_shares: 22180.66, cumulative_amount: 21647.65, cumulative_fees: 0.0 },
    { price: 0.99, total_shares: 22579.83, total_amount: 22354.03, total_fees: 0.0, cumulative_shares: 44760.49, cumulative_amount: 44001.68, cumulative_fees: 0.0 },
  ],
  bid: [
    { price: 0.95, total_shares: 5719.1, total_amount: 5433.15, total_fees: 0.0, cumulative_shares: 5719.1, cumulative_amount: 5433.15, cumulative_fees: 0.0 },
    { price: 0.94, total_shares: 5923.97, total_amount: 5568.53, total_fees: 0.0, cumulative_shares: 11643.07, cumulative_amount: 11001.68, cumulative_fees: 0.0 },
  ],
  last_price: 0.95,
  last_trade_at: "2026-11-12T15:28:28.278125Z",
  last_trade_taker_side: "ask",
  volume_24h: 212677.92,
  trades_24h: 306,
};

const fetchMock = vi.fn();
const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const noContent = () => new Response(null, { status: 204 });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("FUTUUR_PUBLIC_KEY", "pub");
  vi.stubEnv("FUTUUR_PRIVATE_KEY", "secret");
  vi.stubEnv("FUTUUR_API_BASE_URL", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

/** The request the tool sent: method, full URL and parsed JSON body (undefined when it sent none). */
function sent(index = 0) {
  const [url, init] = fetchMock.mock.calls[index];
  return {
    method: init.method as string,
    url: String(url),
    body: init.body === undefined ? undefined : JSON.parse(init.body),
    headers: init.headers as Record<string, string>,
  };
}

const parse = (name: string, args: unknown) => z.object(tool(name).input).parse(args);
const simulate = (args: Record<string, unknown>) => tool("get_bet_simulation").handler(parse("get_bet_simulation", args)) as Promise<any>;

describe("tool definitions", () => {
  it("exposes the expected tools with the right annotations", () => {
    expect(tradingTools.map((t) => t.name)).toEqual([
      "get_bet_simulation", "place_bet", "list_orders", "cancel_order", "cancel_all_orders",
    ]);
    for (const name of ["get_bet_simulation", "list_orders"]) expect(tool(name).annotations.readOnlyHint).toBe(true);
    for (const name of ["place_bet", "cancel_order", "cancel_all_orders"]) {
      expect(tool(name).annotations.readOnlyHint).toBe(false);
      expect(tool(name).annotations.destructiveHint).toBe(true);
    }
  });

  it("describes every argument", () => {
    for (const t of tradingTools) {
      const schema = z.toJSONSchema(z.object(t.input)) as any;
      for (const [field, def] of Object.entries<any>(schema.properties)) {
        expect(def.description, `${t.name}.${field}`).toBeTruthy();
      }
    }
  });

  it("uses the production position and side values", () => {
    expect(() => parse("place_bet", { market: 1, side: "bid", position: "l", currency: "OOM", shares: 5 })).toThrow();
    expect(() => parse("place_bet", { market: 1, side: "buy", position: "long", currency: "OOM", shares: 5 })).toThrow();
    expect(() => parse("place_bet", { market: 1, side: "bid", position: "long", currency: "OOM", shares: 5, price: 1 })).toThrow();
    expect(() => parse("place_bet", { market: 1, side: "bid", position: "long", currency: "OOM", shares: 5, price: 0 })).toThrow();
  });
});

describe("get_bet_simulation", () => {
  it("reads the public order book of the market, never the event list", async () => {
    fetchMock.mockResolvedValue(ok(REAL_LONG_BOOK));
    await simulate({ market: 607897, side: "bid", position: "long", currency: "USDC", shares: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const req = sent();
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://api.futuur.com/v2.0/markets/607897/book/?currency_mode=real_money&position=long");
    expect(req.body).toBeUndefined();
  });

  it("prices a market buy across levels using fee-inclusive level totals", async () => {
    fetchMock.mockResolvedValue(ok(REAL_LONG_BOOK));
    const sim = await simulate({ market: 607897, side: "bid", position: "long", currency: "USDC", shares: 200 });
    expect(sim.estimate).toBe(true);
    expect(sim.order_type).toBe("market");
    expect(sim.immediate_fill.shares).toBe(200);
    // 141.48 @ level 0.04 (5.93) + 58.52 of level 0.05 at 7.5 / 143.12 per share
    expect(sim.immediate_fill.estimated_cost).toBeCloseTo(8.997, 3);
    expect(sim.immediate_fill.average_price).toBeCloseTo(0.045, 3);
    expect(sim.immediate_fill.fills).toEqual([
      { price: 0.04, shares: 141.48, amount: 5.93 },
      { price: 0.05, shares: 58.52, amount: 3.067 },
    ]);
    expect(sim.resting_on_book).toBeNull();
    expect(sim.balance_needed).toBeCloseTo(8.997, 3);
    expect(sim.fees_included).toBe(true);
    expect(sim.best_ask).toBe(0.04);
    expect(sim.best_bid).toBe(0.02);
    expect(sim.last_price).toBe(0.02);
    expect(sim.order).toEqual({ market: 607897, side: "bid", position: "long", currency: "USDC", shares: 200 });
  });

  it("turns a budget into shares at today's prices", async () => {
    fetchMock.mockResolvedValue(ok(REAL_LONG_BOOK));
    const sim = await simulate({ market: 607897, position: "long", currency: "USDC", amount: 10 });
    expect(sim.side).toBe("bid");
    expect(sim.shares).toBe(219.14);
    expect(sim.immediate_fill.shares).toBe(219.14);
    expect(sim.immediate_fill.estimated_cost).toBeCloseTo(9.9997, 3);
    expect(sim.order.shares).toBe(219.14);
    expect(sim.order).not.toHaveProperty("amount");
  });

  it("splits a limit buy into the part that fills now and the part that rests", async () => {
    fetchMock.mockResolvedValue(ok(REAL_LONG_BOOK));
    const sim = await simulate({ market: 607897, side: "bid", position: "long", currency: "USDC", shares: 400, price: 0.05 });
    expect(sim.order_type).toBe("limit");
    expect(sim.immediate_fill.shares).toBe(284.6);
    expect(sim.immediate_fill.estimated_cost).toBeCloseTo(13.43, 3);
    expect(sim.resting_on_book).toEqual({ shares: 115.4, price: 0.05 });
    // cost of the immediate fill plus the reserved value of the resting part
    expect(sim.balance_needed).toBeCloseTo(13.43 + 115.4 * 0.05, 3);
    expect(sim.order).toEqual({ market: 607897, side: "bid", position: "long", currency: "USDC", shares: 400, price: 0.05 });
  });

  it("does not rest the remainder of an ioc order", async () => {
    fetchMock.mockResolvedValue(ok(REAL_LONG_BOOK));
    const sim = await simulate({
      market: 607897, side: "bid", position: "long", currency: "USDC", shares: 400, price: 0.05, time_in_force: "ioc",
    });
    expect(sim.immediate_fill.shares).toBe(284.6);
    expect(sim.resting_on_book).toBeNull();
    expect(sim.warnings.join(" ")).toMatch(/ioc/);
    expect(sim.order.time_in_force).toBe("ioc");
  });

  it("prices a sell against the bids, best price first", async () => {
    fetchMock.mockResolvedValue(ok(REAL_LONG_BOOK));
    const sim = await simulate({ market: 607897, side: "ask", position: "long", currency: "USDC", shares: 700 });
    expect(sim.immediate_fill.shares).toBe(624.69);
    expect(sim.immediate_fill.estimated_proceeds).toBeCloseTo(7.6, 3);
    expect(sim.immediate_fill).not.toHaveProperty("estimated_cost");
    expect(sim).not.toHaveProperty("balance_needed");
    expect(sim.warnings.join(" ")).toMatch(/only 624.69 of 700/i);
    expect(sim.warnings.join(" ")).toMatch(/holding at least/i);
  });

  it("queries the short book in play money with no fees", async () => {
    fetchMock.mockResolvedValue(ok(PLAY_SHORT_BOOK));
    const sim = await simulate({ market: 607897, side: "bid", position: "short", currency: "OOM", shares: 100 });
    expect(sent().url).toBe("https://api.futuur.com/v2.0/markets/607897/book/?currency_mode=play_money&position=short");
    expect(sim.immediate_fill.estimated_cost).toBeCloseTo((100 * 8671.24) / 8939.42, 3);
    expect(sim.fees_included).toBe(false);
  });

  it("rejects bad input combinations with a fixable message", async () => {
    const base = { market: 1, position: "long", currency: "OOM" };
    await expect(simulate({ ...base })).rejects.toThrow(/exactly one of `shares` or `amount`/);
    await expect(simulate({ ...base, shares: 5, amount: 5 })).rejects.toThrow(/exactly one/);
    await expect(simulate({ ...base, side: "ask", amount: 5 })).rejects.toThrow(/only be used when buying/);
    await expect(simulate({ ...base, shares: 5, time_in_force: "ioc" })).rejects.toThrow(/needs a `price`/);
    await expect(simulate({ ...base, shares: 5, price: 0.555 })).rejects.toThrow(/whole number of cents/);
    await expect(simulate({ ...base, shares: 5.123 })).rejects.toThrow(/at most 2 decimals/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains when a budget buys nothing", async () => {
    fetchMock.mockResolvedValue(ok(REAL_LONG_BOOK));
    await expect(simulate({ market: 1, position: "long", currency: "USDC", amount: 10, price: 0.03 })).rejects.toThrow(
      /buys no shares/,
    );
  });
});

describe("place_bet", () => {
  const created = { id: 42, status: "filled", shares_requested: 10, shares_filled: 10 };

  it("POSTs a flat signed body to /orders/ and returns the order", async () => {
    fetchMock.mockResolvedValue(ok(created, 201));
    const result = await runTool(tool("place_bet"), {
      market: 607897, side: "bid", position: "long", currency: "USDC", shares: 10, price: 0.57,
      time_in_force: "gtc", expired_at: "2026-12-31T23:59:00Z", cancel_conflicting_orders: true,
    } as any);
    expect(result.isError).toBeUndefined();
    expect((result as any).structuredContent).toEqual(created);
    const req = sent();
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.futuur.com/v2.0/orders/");
    expect(req.body).toEqual({
      market: 607897, side: "bid", position: "long", currency: "USDC", shares: 10, price: 0.57,
      time_in_force: "gtc", expired_at: "2026-12-31T23:59:00Z", cancel_conflicting_orders: true,
    });
    expect(req.headers.Key).toBe("pub");
    expect(req.headers.HMAC).toMatch(/^[0-9a-f]{128}$/);
  });

  it("omits optional fields it was not given (a market order has no price key)", async () => {
    fetchMock.mockResolvedValue(ok(created, 201));
    await tool("place_bet").handler(
      parse("place_bet", { market: 5, side: "bid", position: "short", currency: "OOM", shares: 25.5 }),
    );
    expect(sent().body).toEqual({ market: 5, side: "bid", position: "short", currency: "OOM", shares: 25.5 });
    expect(Object.keys(sent().body)).not.toContain("price");
    expect(Object.keys(sent().body)).not.toContain("cancel_conflicting_orders");
  });

  it('sells everything held with shares "max" and a price', async () => {
    fetchMock.mockResolvedValue(ok(created, 201));
    await tool("place_bet").handler(
      parse("place_bet", { market: 5, side: "ask", position: "long", currency: "OOM", shares: "max", price: 0.4, time_in_force: "ioc" }),
    );
    expect(sent().body).toEqual({
      market: 5, side: "ask", position: "long", currency: "OOM", shares: "max", price: 0.4, time_in_force: "ioc",
    });
  });

  it("refuses bad combinations before calling the API", async () => {
    const run = (extra: Record<string, unknown>) =>
      tool("place_bet").handler(
        parse("place_bet", { market: 5, side: "bid", position: "long", currency: "OOM", shares: 10, ...extra }),
      );
    await expect(run({ shares: "max" })).rejects.toThrow(/only works when selling/);
    await expect(run({ side: "ask", shares: "max" })).rejects.toThrow(/needs a limit `price`/);
    await expect(run({ time_in_force: "ioc" })).rejects.toThrow(/needs a `price`/);
    await expect(run({ price: 0.123 })).rejects.toThrow(/whole number of cents/);
    await expect(run({ shares: 10.005 })).rejects.toThrow(/at most 2 decimals/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the API's error code and detail", async () => {
    fetchMock.mockResolvedValue(
      ok({ type: "client_error", errors: [{ code: "UserNotEnoughBalance", detail: "Not enough balance for this order.", attr: null }] }, 403),
    );
    const result = await runTool(tool("place_bet"), {
      market: 5, side: "bid", position: "long", currency: "OOM", shares: 10, price: 0.5,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("403");
    expect(result.content[0].text).toContain("UserNotEnoughBalance");
    expect(result.content[0].text).toContain("Not enough balance for this order.");
  });

  it("explains missing API keys instead of calling the API", async () => {
    vi.stubEnv("FUTUUR_PUBLIC_KEY", "");
    const result = await runTool(tool("place_bet"), {
      market: 5, side: "bid", position: "long", currency: "OOM", shares: 10,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/FUTUUR_PUBLIC_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("list_orders", () => {
  it("lists with no filters by default (server defaults to open orders)", async () => {
    fetchMock.mockResolvedValue(ok({ pagination: { total: 0 }, results: [] }));
    await tool("list_orders").handler(parse("list_orders", {}));
    const req = sent();
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://api.futuur.com/v2.0/orders/");
    expect(req.body).toBeUndefined();
    expect(req.headers.Key).toBe("pub");
  });

  it("passes only the filters it was given", async () => {
    fetchMock.mockResolvedValue(ok({ pagination: { total: 1 }, results: [{ id: 1 }] }));
    await tool("list_orders").handler(
      parse("list_orders", {
        status: "partial_filled_cancelled", event: 873, market: 2231, side: "ask", currency_mode: "real_money",
        currency: "USDC", search: "bitcoin", ordering: "-price", limit: 5, offset: 10,
      }),
    );
    expect(sent().url).toBe(
      "https://api.futuur.com/v2.0/orders/?status=partial_filled_cancelled&event=873&market=2231&side=ask" +
        "&currency_mode=real_money&currencies=USDC&search=bitcoin&ordering=-price&limit=5&offset=10",
    );
  });

  it("rejects values the API does not accept", () => {
    expect(() => parse("list_orders", { status: "pending" })).toThrow();
    expect(() => parse("list_orders", { limit: 100 })).toThrow();
    expect(() => parse("list_orders", { ordering: "-id" })).toThrow();
  });

  it("surfaces API errors", async () => {
    fetchMock.mockResolvedValue(
      ok({ type: "validation_error", errors: [{ code: "invalid_choice", detail: '"x" is not a valid choice.', attr: "status" }] }, 400),
    );
    const result = await runTool(tool("list_orders"), { status: "open" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("is not a valid choice");
  });
});

describe("cancel_order", () => {
  it("PATCHes orders/{id}/cancel/ with no body and reports success on 204", async () => {
    fetchMock.mockResolvedValue(noContent());
    const result = await runTool(tool("cancel_order"), { order_id: 10482 });
    expect(result.isError).toBeUndefined();
    expect((result as any).structuredContent).toEqual({ order_id: 10482, cancelled: true });
    const req = sent();
    expect(req.method).toBe("PATCH");
    expect(req.url).toBe("https://api.futuur.com/v2.0/orders/10482/cancel/");
    expect(req.body).toBeUndefined();
    expect(req.headers.HMAC).toMatch(/^[0-9a-f]{128}$/);
  });

  it("surfaces the API's error when the order cannot be cancelled", async () => {
    fetchMock.mockResolvedValue(ok({ type: "client_error", errors: [{ code: "not_found", detail: "Not found.", attr: null }] }, 404));
    const result = await runTool(tool("cancel_order"), { order_id: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("404");
    expect(result.content[0].text).toContain("Not found.");
  });
});

describe("cancel_all_orders", () => {
  const response = { canceled_order_ids: [100, 101], processing_order_ids: [102] };

  it("POSTs only the scope it was given", async () => {
    fetchMock.mockResolvedValue(ok(response));
    const result = await runTool(tool("cancel_all_orders"), { event: 873, market: 2231 });
    expect((result as any).structuredContent).toEqual(response);
    const req = sent();
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.futuur.com/v2.0/orders/cancel-all/");
    expect(req.body).toEqual({ event: 873, market: 2231 });
  });

  it("sends an empty body to cancel everything, but only when confirmed", async () => {
    fetchMock.mockResolvedValue(ok(response));
    const refused = await runTool(tool("cancel_all_orders"), {});
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toMatch(/cancel_everything/);
    expect(fetchMock).not.toHaveBeenCalled();

    await runTool(tool("cancel_all_orders"), { cancel_everything: true });
    expect(sent().body).toEqual({});
  });
});
