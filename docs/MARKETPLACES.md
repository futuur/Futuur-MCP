# Marketplace listings

Where the Futuur MCP server is listed, and how each listing is updated. Maintainer notes.

| Directory | How it gets there | Status |
|---|---|---|
| npm (`@futuur/futuur-mcp`) | Release workflow, or `npm publish` | Live |
| Official MCP Registry (`io.github.futuur/futuur-mcp`) | Release workflow (`server.json`), on every `v*` tag | Live since v2.0.1 |
| Claude Desktop extension (`futuur.mcpb`) | Release workflow attaches it to the GitHub release | Live since v2.0.1 |
| Anthropic extension directory | Manual submission of the `.mcpb` | Not submitted |
| Cursor | "Add to Cursor" button in the README and docs; cursor.directory listing | Button live; directory not submitted |
| Smithery | `smithery.yaml`; claim the repo on smithery.ai | Not claimed |
| Docker MCP Catalog | PR to `docker/mcp-registry` | Submitted: [docker/mcp-registry#7013](https://github.com/docker/mcp-registry/pull/7013) |
| Cline Marketplace | Issue on `cline/mcp-marketplace` | Not submitted |
| Glama, mcp.so | Web forms (repository URL) | Not submitted |
| PulseMCP | Reads the official registry; its own form is paused | Follows the registry |
| claude.ai connectors directory | Needs a hosted remote server with OAuth | Not possible with a local server |

## Official MCP Registry

`server.json` describes the npm package; `mcpName` in `package.json` proves ownership. The `io.github.futuur/*` namespace can only be published from GitHub Actions in this repo (OIDC), not with an interactive login, which is why the Release workflow does it.

## Anthropic extension directory (Claude Desktop)

Build with `npm run mcpb`, or take `futuur.mcpb` from the latest GitHub release. Test it by opening the file in Claude Desktop. Submit through Anthropic's local MCP server submission form (linked from the Claude help centre, "Local MCP server submission guide"). Have ready: the `.mcpb`, the privacy policy URL (already in `manifest.json`), and test credentials for a play-money account, since reviewers exercise the tools.

## Cursor

The README button links to `https://cursor.com/en/install-mcp?name=futuur&config=<base64>` where the config is the base64 of:

```json
{"command":"npx","args":["-y","@futuur/futuur-mcp"],"env":{"FUTUUR_PUBLIC_KEY":"","FUTUUR_PRIVATE_KEY":""}}
```

For the directory, submit the repository at https://cursor.directory (sign in with GitHub, "Submit" under MCP).

## Smithery

Sign in at https://smithery.ai with the `futuur` GitHub organisation and add `futuur/Futuur-MCP`. `smithery.yaml` already declares the stdio start command and the two optional keys.

## Docker MCP Catalog

Fork `docker/mcp-registry`, then from the fork (needs Docker Desktop and `task`):

```bash
task create -- --category finance https://github.com/futuur/Futuur-MCP -e FUTUUR_PUBLIC_KEY=test -e FUTUUR_PRIVATE_KEY=test
task build -- --tools futuur
```

Expected `servers/futuur/server.yaml` (set `commit` to the release commit):

```yaml
name: futuur
image: mcp/futuur
type: server
meta:
  category: finance
  tags:
    - finance
    - prediction-markets
about:
  title: Futuur
  description: "Futuur prediction markets: browse events and prices, simulate and place orders, track positions."
  icon: https://raw.githubusercontent.com/futuur/Futuur-MCP/main/assets/icon.png
source:
  project: https://github.com/futuur/Futuur-MCP
  commit: <release commit sha>
config:
  description: Optional Futuur API keys for account and trading tools (futuur.com → Settings → API keys)
  secrets:
    - name: futuur.public_key
      env: FUTUUR_PUBLIC_KEY
      example: <FUTUUR_PUBLIC_KEY>
    - name: futuur.private_key
      env: FUTUUR_PRIVATE_KEY
      example: <FUTUUR_PRIVATE_KEY>
```

The server lists its tools without keys, so no `tools.json` is needed. Open the PR and share test credentials through the form named in their CONTRIBUTING guide.

## Cline Marketplace

Open https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml with:

- **GitHub Repo URL:** https://github.com/futuur/Futuur-MCP
- **Logo Image:** `assets/icon.png` (400×400 PNG)
- **Reason for Addition:** Futuur is a prediction market with play-money and real-money markets. This is the official server, maintained by Futuur: it lets Cline browse events, prices and order books without credentials, and simulate, place and cancel orders and track positions with the user's API keys. It installs with `npx -y @futuur/futuur-mcp`, needs no build step, and marks every tool that moves a balance as destructive.

They ask you to confirm that Cline can set the server up from the README alone; test that first.

## Glama and mcp.so

- Glama: https://glama.ai/mcp/servers → "Add Server", repository URL.
- mcp.so: https://mcp.so/submit, repository URL and name. There is a paid fast-track; the free path is not described on the page.
