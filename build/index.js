import { MCPServer } from "mcp-framework";
import { configureFutuurApi } from "./utils/api.js";
// Explicitly configure the API keys after loading environment
configureFutuurApi({
    publicKey: process.env.FUTUUR_PUBLIC_KEY,
    privateKey: process.env.FUTUUR_PRIVATE_KEY,
});
// Also store in process.env to ensure availability across imports
process.env.FUTUUR_API_CONFIGURED = "true";
// fetchFromFutuur("me")
//   .then(() => {
//     console.error("✅ [HEALTH] Futuur authentication working");
//   })
//   .catch((e) => {
//     console.error("⚠️ [HEALTH] Futuur auth failed:", e.message);
//   });
// Create MCP server instance
const server = new MCPServer({
    name: "Futuur API Integration",
    version: "1.0.0",
    // transport: {
    //   type: "http-stream",
    //   options: {
    //     cors: {
    //       allowOrigin: "*",
    //     },
    //   },
    // },
});
// Connect transport and start server
server.start();
