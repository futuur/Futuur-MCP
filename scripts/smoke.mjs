// End-to-end check of the built server over stdio: handshake, tool list, and one live public call.
// Usage: node scripts/smoke.mjs [--live]
import { spawn } from "node:child_process";

const live = process.argv.includes("--live");
const child = spawn(process.execPath, ["build/index.js"], {
  env: { ...process.env, FUTUUR_PUBLIC_KEY: "", FUTUUR_PRIVATE_KEY: "" },
  stdio: ["pipe", "pipe", "inherit"],
});
const pending = new Map();
let buffer = "";
let nextId = 1;
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  for (let i; (i = buffer.indexOf("\n")) >= 0; ) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      fail(`non-protocol output on stdout: ${line.slice(0, 200)}`);
    }
    pending.get(message.id)?.(message);
  }
});
function fail(reason) {
  console.error("SMOKE FAILED:", reason);
  child.kill();
  process.exit(1);
}
function request(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, (message) => (message.error ? fail(`${method}: ${JSON.stringify(message.error)}`) : resolve(message.result)));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
setTimeout(() => fail("timed out"), 60_000).unref();

const init = await request("initialize", {
  protocolVersion: "2025-11-25",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0" },
});
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const { tools } = await request("tools/list", {});
const names = tools.map((t) => t.name);
console.log(`protocol ${init.protocolVersion}, server ${init.serverInfo.name} ${init.serverInfo.version}, ${tools.length} tools`);
for (const tool of tools) {
  if (!tool.title || !tool.description || tool.annotations?.readOnlyHint === undefined) fail(`${tool.name}: missing title, description or annotations`);
  for (const [field, schema] of Object.entries(tool.inputSchema?.properties ?? {})) {
    if (!schema.description) fail(`${tool.name}.${field}: missing description`);
  }
}
if (new Set(names).size !== names.length) fail("duplicate tool names");
const writers = tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name).sort();
console.log("write tools:", writers.join(", "));

const noKeys = await request("tools/call", { name: "get_user_profile", arguments: {} });
if (!noKeys.isError || !/FUTUUR_PUBLIC_KEY/.test(noKeys.content[0].text)) fail("missing-keys error not reported as isError");

if (live) {
  const events = await request("tools/call", { name: "get_markets", arguments: { limit: 2 } });
  if (events.isError) fail(`get_markets: ${events.content[0].text}`);
  const first = events.structuredContent.events?.[0];
  if (!first?.id || !first.markets?.length) fail("get_markets returned no events with markets");
  const detail = await request("tools/call", { name: "get_market_details", arguments: { id: first.id } });
  if (detail.isError) fail(`get_market_details: ${detail.content[0].text}`);
  const sim = await request("tools/call", {
    name: "get_bet_simulation",
    arguments: { market: first.markets[0].id, position: "long", currency: "OOM", shares: 10 },
  });
  if (sim.isError) fail(`get_bet_simulation: ${sim.content[0].text}`);
  console.log(`live: event ${first.id} "${first.title}", simulation ok`);
}
console.log("SMOKE OK");
child.kill();
process.exit(0);
