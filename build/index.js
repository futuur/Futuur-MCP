import dotenv from 'dotenv';
dotenv.config(); // Load .env file at the very beginning
// Debug: Check server context - redirect to stderr
console.error('=== SERVER CONTEXT DEBUG ===');
console.error('SERVER env check:', process.env.FUTUUR_PUBLIC_KEY?.slice(0, 6));
console.error('SERVER working dir:', process.cwd());
// Explicitly ensure environment variables are set in process.env
// This ensures they're available even if modules are imported in different contexts
if (!process.env.FUTUUR_PUBLIC_KEY || !process.env.FUTUUR_PRIVATE_KEY) {
    // Try loading again
    dotenv.config();
    if (!process.env.FUTUUR_PUBLIC_KEY || !process.env.FUTUUR_PRIVATE_KEY) {
        console.error('[FATAL] API keys not found in environment');
        process.exit(1);
    }
}
// Enable HTTP dumping if requested
if (process.env.MCP_HTTP_DUMP) {
    // @ts-ignore - Debug helper, suppress import errors
    const { dumpFetch } = await import('../dev/httpDump.js');
    dumpFetch();
    console.error('[DEBUG] HTTP dumping enabled');
}
import { MCPServer } from "mcp-framework";
import { configureFutuurApi, fetchFromFutuur } from './utils/api.js';
// Explicitly configure the API keys after loading environment
configureFutuurApi({
    publicKey: process.env.FUTUUR_PUBLIC_KEY,
    privateKey: process.env.FUTUUR_PRIVATE_KEY,
});
// Also store in process.env to ensure availability across imports
process.env.FUTUUR_API_CONFIGURED = 'true';
// Debug: Log that keys are configured - redirect to stderr
console.error('[DEBUG] API keys configured:', !!process.env.FUTUUR_PUBLIC_KEY, !!process.env.FUTUUR_PRIVATE_KEY);
// Startup health check using new helper - redirect to stderr
console.error('[HEALTH] Testing Futuur API authentication...');
fetchFromFutuur('me')
    .then(() => {
    console.error('✅ [HEALTH] Futuur authentication working');
})
    .catch(e => {
    console.error('⚠️ [HEALTH] Futuur auth failed:', e.message);
});
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
