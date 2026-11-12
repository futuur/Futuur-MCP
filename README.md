# Futuur MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Futuur](https://futuur.com) prediction markets. It lets Claude and other MCP clients browse events and prices, simulate and place orders, and track positions through the Futuur public API (`https://api.futuur.com/v2.0/`).

- Built on the official MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), which implements the 2026-07-28 specification and still serves older clients.
- Every tool has a title, typed arguments, structured results and read-only / destructive annotations, so clients can ask for confirmation before anything that moves money.
- Browsing works without credentials. Account and trading tools need your Futuur API keys.

## Requirements

- Node.js 20 or newer
- Futuur API keys for account and trading tools: futuur.com → Settings → API keys

## Setup

Claude Code:

```bash
claude mcp add futuur -e FUTUUR_PUBLIC_KEY=your_public_key -e FUTUUR_PRIVATE_KEY=your_private_key -- npx -y @futuur/futuur-mcp
```

Any other MCP client (Claude Desktop, Cursor, ...), in its `mcpServers` configuration:

```json
{
  "futuur": {
    "command": "npx",
    "args": ["-y", "@futuur/futuur-mcp"],
    "env": {
      "FUTUUR_PUBLIC_KEY": "your_public_key",
      "FUTUUR_PRIVATE_KEY": "your_private_key"
    }
  }
}
```

| Variable | Purpose |
|---|---|
| `FUTUUR_PUBLIC_KEY`, `FUTUUR_PRIVATE_KEY` | API key pair. Optional for browsing, required for account and trading tools. |
| `FUTUUR_API_BASE_URL` | Override the API base URL (default `https://api.futuur.com/v2.0/`). |

Your keys stay on your machine: the server runs locally over stdio and only talks to the Futuur API.

## Tools

Market data (no keys needed):

| Tool | What it does |
|---|---|
| `get_markets` | List and search events, with category, tag, status, date and ordering filters |
| `get_market_details` | One event with all of its markets (outcomes) |
| `get_price_history` | Price history of an event's markets |
| `get_order_book` | Bids and asks for one market |
| `get_categories`, `get_category_details` | Browse categories |
| `get_exchange_rates`, `convert_to_usd`, `convert_from_usd` | Currency rates and indicative conversions |

Account and positions (keys required):

| Tool | What it does |
|---|---|
| `get_user_profile`, `get_balances`, `get_user_ranking` | Profile, balances per currency, leaderboard position |
| `get_user_bets`, `get_wager_details` | Positions and their purchase/sale history |
| `get_partial_sell_amount` | Estimate what a position would sell for |

Trading (keys required; these change your balance):

| Tool | What it does |
|---|---|
| `get_bet_simulation` | Preview a buy or sell against the live order book. Places nothing. |
| `place_bet` | Place a limit or market order |
| `sell_bet` | Sell all or part of a position |
| `list_orders` | Your open and past orders |
| `cancel_order`, `cancel_all_orders` | Cancel resting orders |

Vocabulary: an *event* is a question; its *markets* are the outcomes, each priced between 0 and 1. `bid` buys and `ask` sells; `long` is the Yes side of a market and `short` is the No side. `OOM` is play money; `USDC`, `USDT` and `USD` are real money. Real-money trading through the API has to be enabled for your account.

## Development

```bash
npm install
npm run build
npm test
node scripts/smoke.mjs --live
```

`npm test` runs the unit tests with a mocked API. The smoke script starts the built server over stdio, checks the handshake and tool metadata, and with `--live` makes a few read-only calls to the production API. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common problems.

## License

ISC
