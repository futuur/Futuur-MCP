# Troubleshooting

**"This tool needs Futuur API keys"**
Set `FUTUUR_PUBLIC_KEY` and `FUTUUR_PRIVATE_KEY` in the MCP server's `env` block, then restart the client. Market data tools work without them.

**401 or 403 from the API**
- The key pair is wrong or inactive: generate a new pair at futuur.com → Settings → API keys.
- The system clock is off: requests are signed with a timestamp.
- Real-money orders also need real-money API trading enabled for the account and a confirmed email.

**"shares must be greater than 0.02" / "price must be a whole number of cents"**
Order sizes have at most 2 decimals and prices are whole cents between 0.01 and 0.99.

**A market order filled only partly**
Market orders take what the book offers and drop the rest. Use `get_bet_simulation` first, or place a limit order with a `price` so the remainder rests on the book.

**The server does not start**
It needs Node.js 20 or newer (`node --version`). Run `npx -y @futuur/futuur-mcp` in a terminal: it should wait silently for input; any error is printed to stderr.

**Checking the server by hand**
`node scripts/smoke.mjs --live` from a checkout runs the handshake, lists the tools and makes read-only calls to the API.
