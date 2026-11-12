import { McpServer } from "@modelcontextprotocol/server";

import { registerTools } from "./tool.js";
import { allTools } from "./tools/index.js";

export const SERVER_VERSION = "2.0.0";

const INSTRUCTIONS = `\
Futuur is a prediction market. These tools call the Futuur public API (v2.0).

Vocabulary: an "event" is a question (e.g. an election); each event has "markets" (its outcomes),
each with a price between 0 and 1 that reads as a probability. A "wager" is the user's position in
one market. An "order" is a limit order on a market's order book.

Currencies: OOM is play money; real-money trading uses USDC and other real currencies. Many tools
take currency_mode ("play_money" or "real_money"). Never assume real money: ask if it is unclear.

Browsing events, markets, prices and categories works without API keys. Account, positions and
trading tools need the user's API keys (FUTUUR_PUBLIC_KEY / FUTUUR_PRIVATE_KEY).

Trading: always simulate first and show the user the cost, shares and price, then place, sell or
cancel only after they explicitly confirm. Orders move real balances and cannot be undone.`;

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "futuur", title: "Futuur", version: SERVER_VERSION, websiteUrl: "https://futuur.com" },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );
  registerTools(server, allTools);
  return server;
}
