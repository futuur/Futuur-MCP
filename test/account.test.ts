import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runTool } from "../src/tool.js";
import { accountTools } from "../src/tools/account.js";

const tool = (name: string) => accountTools.find((t) => t.name === name)!;

describe("account tools", () => {
  const fetchMock = vi.fn();
  const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

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

  it("exposes the expected tools, all read-only", () => {
    expect(accountTools.map((t) => t.name)).toEqual(["get_user_profile", "get_balances", "get_user_ranking"]);
    for (const t of accountTools) expect(t.annotations.readOnlyHint).toBe(true);
  });

  it("get_user_profile: GET me/ signed, without UI noise", async () => {
    fetchMock.mockResolvedValue(
      ok({
        id: 7,
        username: "ada",
        email: "ada@example.com",
        picture: "https://x/p.jpg",
        sort_algorithm: ["in-house"],
        test_segments: {},
        api_version: "2.0",
        wallet: { OOM: 100, USDC: 5 },
        public_api_real_money_enabled: true,
        settings: { language: "en", seen_onboarding_app: true, auto_cancel_conflicting_orders: false },
      }),
    );
    const result: any = await runTool(tool("get_user_profile"), {});
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.futuur.com/v2.0/me/");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers.Key).toBe("pub");
    expect(init.headers.HMAC).toBeTruthy();
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      id: 7,
      username: "ada",
      email: "ada@example.com",
      wallet: { OOM: 100, USDC: 5 },
      public_api_real_money_enabled: true,
      settings: { language: "en", auto_cancel_conflicting_orders: false },
    });
  });

  it("get_balances: GET me/balances/ with an optional currency filter", async () => {
    const rows = [{ currency: "OOM", amount: "5000.00" }];
    fetchMock.mockResolvedValue(ok(rows));
    const all: any = await runTool(tool("get_balances"), {});
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.futuur.com/v2.0/me/balances/");
    expect(all.structuredContent).toEqual({ result: rows });

    await runTool(tool("get_balances"), { currency: "usdc" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe("https://api.futuur.com/v2.0/me/balances/?currency=usdc");
    expect(init.method).toBe("GET");
  });

  it("get_user_ranking: GET me/ranking/", async () => {
    fetchMock.mockResolvedValue(ok({ ranking: "127" }));
    const result: any = await runTool(tool("get_user_ranking"), {});
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.futuur.com/v2.0/me/ranking/");
    expect(init.method).toBe("GET");
    expect(result.structuredContent).toEqual({ ranking: "127" });
  });

  it("reports API errors as isError results", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "client_error", errors: [{ code: "not_authenticated", detail: "bad key" }] }), { status: 401 }),
    );
    const result: any = await runTool(tool("get_user_profile"), {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("401");
    expect(result.content[0].text).toContain("bad key");
  });

  it("explains missing API keys without calling the API", async () => {
    vi.stubEnv("FUTUUR_PUBLIC_KEY", "");
    vi.stubEnv("FUTUUR_PRIVATE_KEY", "");
    for (const t of accountTools) {
      const result: any = await runTool(t, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/FUTUUR_PUBLIC_KEY.*FUTUUR_PRIVATE_KEY/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
