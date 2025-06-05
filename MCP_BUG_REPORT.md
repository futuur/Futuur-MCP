# MCP Framework Bug Report: Authentication Headers Not Working in Tools

## Summary
HMAC-based authentication headers work perfectly in standalone Node.js execution but fail when the same code runs through MCP Framework tools, even with global fetch monkey-patching.

## Environment
- **MCP Framework Version**: v0.2.13
- **Node.js Version**: v18+
- **Platform**: macOS 14.5.0
- **Transport**: Default STDIO

## Expected Behavior
Authentication headers (`Key`, `Timestamp`, `HMAC`) should be properly transmitted in HTTP requests made by MCP tools.

## Actual Behavior
HTTP requests made through MCP tools receive 403 Forbidden responses despite:
- Headers being properly generated
- Same code working perfectly outside MCP context
- Global fetch monkey-patch successfully injecting headers (verified by logs)

## Reproduction Case

### 1. Working Standalone Code
```javascript
// standalone.js - WORKS PERFECTLY
import crypto from 'crypto';

function buildAuthHeaders(payload) {
  const key = process.env.API_PUBLIC_KEY;
  const secret = process.env.API_PRIVATE_KEY;
  const timestamp = Math.floor(Date.now() / 1000);
  
  const paramsToSign = { ...payload, Key: key, Timestamp: timestamp };
  const paramString = new URLSearchParams(paramsToSign).toString();
  const hmac = crypto.createHmac("sha512", secret).update(paramString).digest("hex");
  
  return { Key: key, Timestamp: timestamp.toString(), HMAC: hmac };
}

// Direct API call - SUCCESS
const headers = buildAuthHeaders({ outcome: 123, amount: 100 });
const response = await fetch('https://api.example.com/protected', { 
  headers 
});
console.log(response.status); // 200 OK
```

### 2. MCP Tool Implementation - FAILS
```javascript
// tool.js - FAILS WITH 403
import { MCPTool } from "mcp-framework";

class TestTool extends MCPTool {
  async execute(input) {
    // IDENTICAL auth code as above
    const headers = buildAuthHeaders(input);
    const response = await fetch('https://api.example.com/protected', { 
      headers 
    });
    console.log(response.status); // 403 Forbidden
  }
}
```

### 3. Monkey-Patch Attempt - STILL FAILS
```javascript
// index.js - Monkey-patch installed but still fails
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (url.includes('api.example.com')) {
    init.headers = { ...init.headers, ...buildAuthHeaders({}) };
    console.log('Headers injected:', Object.keys(init.headers)); // Shows headers
  }
  return originalFetch(url, init);
};

// Tool still gets 403 despite monkey-patch logging successful header injection
```

## Evidence 
1. **Direct execution**: 200 OK with proper headers
2. **Manual curl**: 200 OK with identical headers  
3. **Monkey-patch standalone**: 200 OK with injected headers
4. **MCP tool execution**: 403 Forbidden despite monkey-patch logs showing header injection

## Impact
This prevents legitimate HMAC authentication workflows that are common in financial, betting, and API platforms.

## Suspected Root Cause
MCP Framework may be:
- Using internal fetch implementation that bypasses global overrides
- Running tool code in sandboxed context 
- Intercepting/modifying requests at lower level than global fetch
- Having async timing issues with auth header generation

## Request
Please investigate how MCP Framework handles HTTP requests in tool execution contexts and ensure global fetch overrides work as expected for authentication purposes. 