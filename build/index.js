import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// Import our modules
import { registerMarketTools } from "./tools/markets.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerUserTools } from "./tools/me.js";
import { registerBetTools } from "./tools/bets.js";
console.log("Starting Futuur API Integration server...");
// Create an MCP server
const server = new McpServer({
    name: "Futuur API Integration",
    version: "1.0.0",
});
// Register all tools and resources
registerMarketTools(server);
registerCategoryTools(server);
registerUserTools(server);
registerBetTools(server);
// Start receiving messages on stdin and sending messages on stdout
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Futuur MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
