import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { randomUUID } from "node:crypto";
// Import our modules
import { registerMarketTools } from "./tools/markets.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerUserTools } from "./tools/me.js";
import { registerBetTools } from "./tools/bets.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
const app = express();
app.use(express.json());
// Map to store transports by session ID
const transports = {};
// Create MCP server instance
const server = new McpServer({
    name: "Futuur API Integration",
    version: "1.0.0",
});
// Register all tools and resources
registerMarketTools(server);
registerCategoryTools(server);
registerUserTools(server);
registerBetTools(server);
// Root endpoint handler
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Futuur MCP Server is running",
        version: "1.0.0"
    });
});
// Handle POST requests for client-to-server communication
app.post("/mcp", async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers["mcp-session-id"];
    let transport;
    if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
    }
    else if (!sessionId && req.body.method === "initialize") {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
                // Store the transport by session ID
                transports[sessionId] = transport;
            },
        });
        // Clean up transport when closed
        transport.onclose = () => {
            if (transport.sessionId) {
                delete transports[transport.sessionId];
            }
        };
        // Connect to the MCP server
        await server.connect(transport);
    }
    else {
        // Invalid request
        res.status(400).json({
            jsonrpc: "2.0",
            error: {
                code: -32000,
                message: "Bad Request: No valid session ID provided",
            },
            id: null,
        });
        return;
    }
    // Handle the request
    await transport.handleRequest(req, res, req.body);
});
// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send("Invalid or missing session ID");
        return;
    }
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};
// Handle GET requests for server-to-client notifications via SSE
app.get("/mcp", handleSessionRequest);
// Handle DELETE requests for session termination
app.delete("/mcp", handleSessionRequest);
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Futuur MCP Server running on port ${PORT}`);
});
