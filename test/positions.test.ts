import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { z } from "zod";

import { runTool, type ToolDef } from "../src/tool.js";
import { positionTools } from "../src/tools/positions.js";

const tool = (name: string) => positionTools.find((t) => t.name === name)!;
/** Like the server: validate and apply schema defaults before the handler runs. */
const run = (def: ToolDef<any>, args: unknown) => runTool(def, z.object(def.input).parse(args));
const BASE = "https://api.futuur.com/v2.0/";

function makeWager(overrides: Record<string, any> = {}) {
  return {
    id: 55,
    status: "purchased",
    user: { id: 7, username: "ada", picture: "https://x/p.jpg", has_custom_picture: true },
    event: { id: 900, title: "Who wins?", status: "open", is_wagerable: true, order_book_enabled: false, resolution_mode: "exclusive" },
    market: {
      id: 3801, title: "Team A", price: { OOM: 0.4 }, long_label: "Yes", short_label: "No", status: "open",
      thumbnail: "https://x/t.webp", volume_play_money: 12, position_labels: "yesno", order: 0,
    },
    position: "long",
    currency: "OOM",
    shares: 10,
    amount_on_sell: 4.2,
    ...overrides,
  };
}

describe("position tools", () => {
  const fetchMock = vi.fn();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

  /** Routes mocked responses by "METHOD path" (path relative to the v2.0 base). */
  function route(table: Record<string, unknown | ((init: any) => Response)>) {
    fetchMock.mockImplementation(async (url: URL, init: any) => {
      const key = `${init.method} ${String(url).replace(BASE, "")}`;
      const entry = table[key];
      if (entry === undefined) throw new Error(`unexpected request ${key}`);
      return typeof entry === "function" ? entry(init) : json(entry);
    });
  }
  const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init.method} ${String(url).replace(BASE, "")}`);

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

  it("exposes the expected tools with the right annotations", () => {
    expect(positionTools.map((t) => t.name)).toEqual([
      "get_user_bets", "get_wager_details", "get_partial_sell_amount", "sell_bet",
    ]);
    expect(tool("sell_bet").annotations.readOnlyHint).toBe(false);
    expect(tool("sell_bet").annotations.destructiveHint).toBe(true);
    for (const name of ["get_user_bets", "get_wager_details", "get_partial_sell_amount"]) {
      expect(tool(name).annotations.readOnlyHint).toBe(true);
    }
  });

  describe("get_user_bets", () => {
    it("lists own wagers with default paging and trims nested noise", async () => {
      const page = { pagination: { total: 1, next: null, previous: null, page_size: 20, offset: 0 }, results: [makeWager()] };
      fetchMock.mockResolvedValue(json(page));
      const result: any = await run(tool("get_user_bets"), {});
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}wagers/?limit=20&offset=0`);
      expect(init.method).toBe("GET");
      expect(init.headers.Key).toBe("pub");
      const wager = result.structuredContent.results[0];
      expect(result.structuredContent.pagination.total).toBe(1);
      expect(wager.user).toEqual({ id: 7, username: "ada" });
      expect(wager.market).toEqual({
        id: 3801, title: "Team A", price: { OOM: 0.4 }, long_label: "Yes", short_label: "No", status: "open",
      });
      expect(wager.event.order_book_enabled).toBe(false);
      expect(wager.amount_on_sell).toBe(4.2);
    });

    it("passes every filter through", async () => {
      fetchMock.mockResolvedValue(json({ pagination: {}, results: [] }));
      await run(tool("get_user_bets"), {
        active: true, currency_mode: "real_money", event: 900, following: true, user: 12, limit: 5, offset: 10,
      });
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        `${BASE}wagers/?user=12&event=900&active=true&following=true&currency_mode=real_money&limit=5&offset=10`,
      );
    });

    it("omits currency_mode for all and sends past_bets", async () => {
      fetchMock.mockResolvedValue(json({ pagination: {}, results: [] }));
      await run(tool("get_user_bets"), { past_bets: true, currency_mode: "all" });
      expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}wagers/?past_bets=true&limit=20&offset=0`);
    });

    it("rejects contradictory filters without calling the API", async () => {
      const both: any = await run(tool("get_user_bets"), { active: true, past_bets: true });
      expect(both.isError).toBe(true);
      expect(both.content[0].text).toMatch(/active or past_bets/);
      const following: any = await run(tool("get_user_bets"), { following: true });
      expect(following.isError).toBe(true);
      expect(following.content[0].text).toMatch(/event/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("get_wager_details", () => {
    it("GETs wagers/{id}/ and slims the actions history", async () => {
      fetchMock.mockResolvedValue(
        json(
          makeWager({
            actions: [
              {
                id: 1, action: "purchase", price: 0.4, shares: 10, amount: 4, currency: "OOM", position: "long",
                created: "2026-01-01T00:00:00Z", market: { id: 3801 }, event: { id: 900 }, user: { id: 7 },
              },
            ],
          }),
        ),
      );
      const result: any = await run(tool("get_wager_details"), { id: 55 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}wagers/55/`);
      expect(init.method).toBe("GET");
      expect(result.structuredContent.actions).toEqual([
        { id: 1, action: "purchase", price: 0.4, shares: 10, amount: 4, currency: "OOM", position: "long", created: "2026-01-01T00:00:00Z" },
      ]);
    });

    it("turns an API error into an isError result", async () => {
      fetchMock.mockResolvedValue(
        json({ type: "client_error", errors: [{ code: "not_found", detail: "Not found.", attr: null }] }, 404),
      );
      const result: any = await run(tool("get_wager_details"), { id: 999 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("404");
      expect(result.content[0].text).toContain("Not found.");
    });
  });

  describe("get_partial_sell_amount", () => {
    it("GETs get_partial_amount_on_sell with shares and flags the whole-position caveat", async () => {
      fetchMock.mockResolvedValue(json({ amount: 4.2, shares: 4, price: 1.05 }));
      const result: any = await run(tool("get_partial_sell_amount"), { id: 55, shares: 4 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}wagers/55/get_partial_amount_on_sell/?shares=4`);
      expect(init.method).toBe("GET");
      expect(result.structuredContent).toMatchObject({ amount: 4.2, shares: 4, price: 1.05 });
      expect(result.structuredContent.note).toMatch(/entire wager/);
    });

    it("simulates the whole position when shares is omitted", async () => {
      fetchMock.mockResolvedValue(json({ amount: 4.2, shares: null, price: null }));
      const result: any = await run(tool("get_partial_sell_amount"), { id: 55 });
      expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}wagers/55/get_partial_amount_on_sell/`);
      expect(result.structuredContent).toEqual({ amount: 4.2, shares: null, price: null });
    });
  });

  describe("sell_bet", () => {
    const me = { id: 7, username: "ada" };

    it("sells a whole non-order-book position with PATCH wagers/{id}/ and an empty body", async () => {
      route({
        "GET wagers/55/": makeWager(),
        "GET me/": me,
        "PATCH wagers/55/": makeWager({ status: "sold", shares: 0 }),
      });
      const result: any = await run(tool("sell_bet"), { id: 55 });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent.status).toBe("sold");
      expect(calls().sort()).toEqual(["GET me/", "GET wagers/55/", "PATCH wagers/55/"]);
      const patch = fetchMock.mock.calls.find(([, init]) => init.method === "PATCH")!;
      expect(JSON.parse(patch[1].body)).toEqual({});
      expect(patch[1].headers.HMAC).toBeTruthy();
    });

    it("sends shares for a partial sale", async () => {
      route({ "GET wagers/55/": makeWager(), "GET me/": me, "PATCH wagers/55/": makeWager({ shares: 6 }) });
      await run(tool("sell_bet"), { id: 55, shares: 4 });
      const patch = fetchMock.mock.calls.find(([, init]) => init.method === "PATCH")!;
      expect(String(patch[0])).toBe(`${BASE}wagers/55/`);
      expect(JSON.parse(patch[1].body)).toEqual({ shares: 4 });
    });

    it("treats selling exactly the shares held as a full sale", async () => {
      route({ "GET wagers/55/": makeWager(), "GET me/": me, "PATCH wagers/55/": makeWager({ status: "sold" }) });
      await run(tool("sell_bet"), { id: 55, shares: 10 });
      const patch = fetchMock.mock.calls.find(([, init]) => init.method === "PATCH")!;
      expect(JSON.parse(patch[1].body)).toEqual({});
    });

    it.each(["OOM", "USDC", "USDT", "USD"])("sells %s wagers on order-book events with an ask order", async (currency) => {
      route({
        "GET wagers/55/": makeWager({ currency, event: { ...makeWager().event, order_book_enabled: true } }),
        "GET me/": me,
        "POST orders/": { id: 991, status: "filled", shares_filled: 4 },
      });
      const result: any = await run(tool("sell_bet"), { id: 55, shares: 4 });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent.sold_via).toBe("order");
      expect(result.structuredContent.order.id).toBe(991);
      const post = fetchMock.mock.calls.find(([, init]) => init.method === "POST")!;
      expect(JSON.parse(post[1].body)).toEqual({ market: 3801, side: "ask", position: "long", currency, shares: 4 });
      expect(calls().some((c) => c.startsWith("PATCH"))).toBe(false);
    });

    it("sells the whole order-book position: held shares at market, or \"max\" with a limit price", async () => {
      const wager = makeWager({ shares: 10.129, event: { ...makeWager().event, order_book_enabled: true } });
      route({ "GET wagers/55/": wager, "GET me/": me, "POST orders/": { id: 1 } });
      await run(tool("sell_bet"), { id: 55 });
      await run(tool("sell_bet"), { id: 55, price: 0.6 });
      const bodies = fetchMock.mock.calls.filter(([, init]) => init.method === "POST").map(([, init]) => JSON.parse(init.body));
      expect(bodies[0]).toEqual({ market: 3801, side: "ask", position: "long", currency: "OOM", shares: 10.12 });
      expect(bodies[1]).toEqual({ market: 3801, side: "ask", position: "long", currency: "OOM", shares: "max", price: 0.6 });
    });

    it("rejects a price for a wager that is not on an order-book event", async () => {
      route({ "GET wagers/55/": makeWager(), "GET me/": me });
      const result: any = await run(tool("sell_bet"), { id: 55, price: 0.6 });
      expect(result.isError).toBe(true);
      expect(calls().some((c) => c.startsWith("PATCH") || c.startsWith("POST"))).toBe(false);
    });

    it("still sells non-stable real-currency wagers on order-book events with the wager call", async () => {
      route({
        "GET wagers/55/": makeWager({ currency: "BTC", event: { ...makeWager().event, order_book_enabled: true } }),
        "GET me/": me,
        "PATCH wagers/55/": makeWager({ status: "sold", currency: "BTC" }),
      });
      const result: any = await run(tool("sell_bet"), { id: 55 });
      expect(result.isError).toBeUndefined();
      expect(calls()).toContain("PATCH wagers/55/");
    });

    it("refuses wagers that are not open, belong to someone else, are oversold or on a closed event", async () => {
      route({ "GET wagers/55/": makeWager({ status: "sold" }), "GET me/": me });
      const sold: any = await run(tool("sell_bet"), { id: 55 });
      expect(sold.isError).toBe(true);
      expect(sold.content[0].text).toContain('status "sold"');

      route({ "GET wagers/55/": makeWager({ user: { id: 99, username: "bob" } }), "GET me/": me });
      const other: any = await run(tool("sell_bet"), { id: 55 });
      expect(other.isError).toBe(true);
      expect(other.content[0].text).toContain("another user");

      route({ "GET wagers/55/": makeWager(), "GET me/": me });
      const oversold: any = await run(tool("sell_bet"), { id: 55, shares: 11 });
      expect(oversold.isError).toBe(true);
      expect(oversold.content[0].text).toContain("holds only 10 shares");

      route({ "GET wagers/55/": makeWager({ event: { ...makeWager().event, is_wagerable: false } }), "GET me/": me });
      const closed: any = await run(tool("sell_bet"), { id: 55 });
      expect(closed.isError).toBe(true);
      expect(closed.content[0].text).toContain("closed for trading");

      expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
    });

    it("translates the server's class-name error codes into readable messages", async () => {
      route({
        "GET wagers/55/": makeWager(),
        "GET me/": me,
        "PATCH wagers/55/": () =>
          json({ type: "server_error", errors: [{ code: "ActionDuplicated", detail: "Internal Server Error", attr: null }] }, 500),
      });
      const result: any = await run(tool("sell_bet"), { id: 55 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("sold a moment ago");
    });

    it("lets other API errors propagate with their status and detail", async () => {
      route({
        "GET wagers/55/": makeWager(),
        "GET me/": me,
        "PATCH wagers/55/": () =>
          json({ type: "client_error", errors: [{ code: "invalid_model_for_bet", detail: "Invalid model for bet." }] }, 403),
      });
      const result: any = await run(tool("sell_bet"), { id: 55 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("403");
      expect(result.content[0].text).toContain("Invalid model for bet.");
    });
  });

  it("explains missing API keys without calling the API", async () => {
    vi.stubEnv("FUTUUR_PUBLIC_KEY", "");
    vi.stubEnv("FUTUUR_PRIVATE_KEY", "");
    for (const t of positionTools) {
      const result: any = await run(t, { id: 55 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/FUTUUR_PUBLIC_KEY.*FUTUUR_PRIVATE_KEY/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
