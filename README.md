# Futuur MCP Server

Model Context Protocol (MCP) server for the [Futuur](https://futuur.com) prediction markets API. Gives Claude (and any MCP-compatible client) the ability to browse markets, simulate and place bets, manage orders, and track wager positions.

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
[![smithery badge](https://smithery.ai/badge/@futuur/futuur-mcp)](https://smithery.ai/server/@futuur/futuur-mcp)

</div>

---

## Quick start (recommended — Smithery)

```bash
# Claude Desktop
npx -y @smithery/cli install @futuur/futuur-mcp --client claude

# Cursor
npx -y @smithery/cli install @futuur/futuur-mcp --client cursor
```

Smithery will prompt you for your API keys and handle the rest.

---

## Manual setup

### 1. Get API keys

Log in to [futuur.com](https://futuur.com) → Settings → API → generate a public/private key pair.

### 2. Clone and build

```bash
git clone https://github.com/futuur/Futuur-MCP.git
cd Futuur-MCP
npm install
npm run build
```

### 3. Configure your MCP client

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "futuur": {
      "command": "node",
      "args": ["/absolute/path/to/Futuur-MCP/build/index.js"],
      "env": {
        "FUTUUR_PUBLIC_KEY": "your_public_key_here",
        "FUTUUR_PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

**Claude Code** (CLI) — run once to register the server:

```bash
claude mcp add futuur node /absolute/path/to/Futuur-MCP/build/index.js \
  -e FUTUUR_PUBLIC_KEY=your_public_key_here \
  -e FUTUUR_PRIVATE_KEY=your_private_key_here
```

Or add to `.claude/settings.json` under `"mcpServers"` using the same format as Claude Desktop above.

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "futuur": {
      "command": "node",
      "args": ["/absolute/path/to/Futuur-MCP/build/index.js"],
      "env": {
        "FUTUUR_PUBLIC_KEY": "your_public_key_here",
        "FUTUUR_PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

### 4. Restart your client

Claude Desktop / Cursor need a full restart after editing config files.

---

## Available tools

### Market discovery

| Tool | Description |
|------|-------------|
| `get_markets` | List/search events with filters (category, tag, status, ordering, etc.) |
| `get_market_details` | Full details for a single event including all nested markets |
| `get_categories` | List market categories (legacy v1 endpoint) |
| `get_category_details` | Details for a specific category |
| `get_price_history` | Historical price data for an event (`day`, `week`, `month`, `year`, `all_time`) |

### Account

| Tool | Description |
|------|-------------|
| `get_user_profile` | Authenticated user profile and balances |
| `get_user_ranking` | Your position on the leaderboard |

### Trading

| Tool | Description |
|------|-------------|
| `get_bet_simulation` | Preview a limit order (cost/shares) without placing it |
| `place_bet` | Execute a limit order using a confirmed simulation payload |
| `list_orders` | List your open/filled/cancelled orders |
| `cancel_order` | Cancel an open order by ID |

### Positions (wagers)

| Tool | Description |
|------|-------------|
| `get_user_bets` | List your wager positions with optional filters |
| `get_wager_details` | Full details for a single wager |
| `get_partial_sell_amount` | Simulate proceeds from selling N shares |
| `sell_bet` | Sell all or part of a wager position |

---

## Typical workflow with Claude

```
1. "Show me the top 10 markets by volume"           → get_markets
2. "Give me details on event #1234"                 → get_market_details
3. "Simulate buying 100 OOM on the Yes outcome"     → get_bet_simulation (requires event_id + market_id)
4. "Looks good, place the bet"                      → place_bet
5. "Show my open positions"                         → get_user_bets
6. "How much would I get if I sold 50 shares?"      → get_partial_sell_amount
7. "Sell them"                                      → sell_bet
```

> **Tip:** Use `play_money` mode (`currency_mode: "play_money"`) to test without risking real funds. OOM is the play money currency.

---

## Authentication

All authenticated requests use HMAC-SHA512 signatures. The server handles this automatically — just provide your public and private keys via environment variables (`FUTUUR_PUBLIC_KEY` / `FUTUUR_PRIVATE_KEY`).

Public endpoints (events listing, event details) do not require authentication.

---

## API reference

Full API documentation: [docs.futuur.com](https://docs.futuur.com)  
OpenAPI schema (machine-readable): [api.futuur.com/docs/schema/](https://api.futuur.com/docs/schema/)

---

## Development

```bash
npm run dev      # Run with tsx (hot reload)
npm run build    # Compile TypeScript
npm run start    # Run compiled build
npm test         # Run tests
```

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

<div align="center">Made with ❤️ by the Futuur Team</div>
