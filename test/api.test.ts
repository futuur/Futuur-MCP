import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authHeaders, futuur, FutuurApiError, pyStr, quotePlus, sign, signingString } from "../src/api.js";

// Reference values produced by the API's own algorithm:
//   hmac.new(secret, urlencode(sorted(params.items())), sha512).hexdigest()
const GET_PARAMS = { Key: "pub", Timestamp: 1700000000, limit: "5", search: "who wins? (2026) *~" };
const GET_STRING = "Key=pub&Timestamp=1700000000&limit=5&search=who+wins%3F+%282026%29+%2A~";
const GET_SIG =
  "80384b42dbe36f22fa6f9577a98cc67ccf949a77c328e4973930f38032efb98e4313e986d587d2398d77ca232a43cdfd1f0048199be4c4c709432e6ab3caafb0";
const POST_PARAMS = {
  Key: "pub", Timestamp: 1700000000, market: 123, side: "bid", position: "l", price: 0.55, shares: 10,
  currency: "OOM", cancel_conflicting_orders: true, expired_at: null, note: "it's ok",
};
const POST_STRING =
  "Key=pub&Timestamp=1700000000&cancel_conflicting_orders=True&currency=OOM&expired_at=None&market=123&note=it%27s+ok&position=l&price=0.55&shares=10&side=bid";
const POST_SIG =
  "bd412e9ac9ddd314c524a2b5a8569c1725661b8ed48a4cb2be7f1f38a43ab5884fa730caa5be15daf35bc97b372586bb5d5bb77e1335510601c76b294aad1395";

describe("signing matches the API's Python implementation", () => {
  it("renders values like Python str()", () => {
    expect(pyStr(true)).toBe("True");
    expect(pyStr(false)).toBe("False");
    expect(pyStr(null)).toBe("None");
    expect(pyStr(0.55)).toBe("0.55");
    expect(pyStr(0.00001)).toBe("1e-05");
    expect(pyStr(1.5e-7)).toBe("1.5e-07");
    expect(pyStr(0.0001)).toBe("0.0001");
    expect(pyStr(1e21)).toBe("1e+21");
    expect(pyStr([1, "a", true])).toBe("[1, 'a', True]");
    expect(pyStr({ a: 1 })).toBe("{'a': 1}");
  });
  it("encodes like quote_plus", () => {
    expect(quotePlus("a b*c~d(e)'!")).toBe("a+b%2Ac~d%28e%29%27%21");
  });
  it("signs query parameters", () => {
    expect(signingString(GET_PARAMS)).toBe(GET_STRING);
    expect(sign(GET_PARAMS, "secret")).toBe(GET_SIG);
  });
  it("signs JSON bodies with booleans and nulls", () => {
    expect(signingString(POST_PARAMS)).toBe(POST_STRING);
    expect(sign(POST_PARAMS, "secret")).toBe(POST_SIG);
  });
});

describe("futuur()", () => {
  const fetchMock = vi.fn();
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
  const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

  it("calls the v2.0 base path and signs the query", async () => {
    fetchMock.mockResolvedValue(ok({ results: [] }));
    await futuur("events/", { query: { limit: 5, tag: undefined, categories: [1, 2] } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.futuur.com/v2.0/events/?limit=5&categories=1%2C2");
    expect(init.headers.Key).toBe("pub");
    expect(init.headers.HMAC).toBe(
      sign({ limit: "5", categories: "1,2", Key: "pub", Timestamp: Number(init.headers.Timestamp) }, "secret"),
    );
  });

  it("signs the JSON body it sends", async () => {
    fetchMock.mockResolvedValue(ok({ id: 1 }));
    await futuur("orders/", { method: "POST", body: { market: 1, cancel_conflicting_orders: true, price: undefined } });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ market: 1, cancel_conflicting_orders: true });
    expect(init.headers.HMAC).toBe(
      sign({ market: 1, cancel_conflicting_orders: true, Key: "pub", Timestamp: Number(init.headers.Timestamp) }, "secret"),
    );
  });

  it("calls anonymously without keys, and refuses when auth is required", async () => {
    vi.stubEnv("FUTUUR_PUBLIC_KEY", "");
    fetchMock.mockResolvedValue(ok({}));
    await futuur("categories/");
    expect(fetchMock.mock.calls[0][1].headers.Key).toBeUndefined();
    await expect(futuur("me/", { auth: "required" })).rejects.toThrow(/FUTUUR_PUBLIC_KEY/);
  });

  it("turns API errors into FutuurApiError with the response detail", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "nope" }), { status: 400 }));
    const error = await futuur("orders/", { method: "POST", body: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(FutuurApiError);
    expect(error.status).toBe(400);
    expect(error.message).toContain("nope");
  });

  it("honours FUTUUR_API_BASE_URL", async () => {
    vi.stubEnv("FUTUUR_API_BASE_URL", "https://example.test/v2.0");
    fetchMock.mockResolvedValue(ok({}));
    await futuur("/me/");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://example.test/v2.0/me/");
    expect(authHeaders({}, 1).Timestamp).toBe("1");
  });
});
