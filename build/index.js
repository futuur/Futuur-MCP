import { MCPServer } from "mcp-framework";
// Create MCP server instance
const server = new MCPServer({
    name: "Futuur API Integration",
    version: "1.0.0",
    transport: {
        type: "sse",
        options: {
            port: 3000,
            cors: {
                allowOrigin: "*",
            },
        },
    },
});
// Connect transport and start server
server.start();
