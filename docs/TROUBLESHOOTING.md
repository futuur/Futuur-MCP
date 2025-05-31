# Troubleshooting Guide

## Futuur API Authentication Issues

### Common Symptoms
- 403 Forbidden errors when calling authenticated endpoints
- Tools work in standalone execution but fail through MCP
- Authentication headers appear to be generated correctly but requests still fail

### Debug Checklist

1. **Verify Environment Variables**
   ```bash
   # Check that API keys are properly set
   echo $FUTUUR_PUBLIC_KEY
   echo $FUTUUR_PRIVATE_KEY
   ```
   - Keys should be non-empty strings
   - Public key should start with hex characters
   - Private key should be a long secret string

2. **Check MCP Framework Version**
   ```bash
   npm list mcp-framework
   ```
   - Version 0.2.13 has known authentication header issues
   - Version 0.2.14+ should not require the patch
   - The patch is automatically applied for problematic versions

3. **Monitor Startup Health Check**
   ```
   [HEALTH] Testing Futuur API authentication...
   ✅ [HEALTH] Futuur authentication working
   ```
   - Should see success message on startup
   - Warning messages indicate configuration issues

### Manual Testing

Test authentication outside MCP context:
```javascript
import { buildAuthHeaders } from './src/utils/api.js';

const headers = buildAuthHeaders({ test: 'payload' });
const response = await fetch('https://api.futuur.com/api/v1/me', { headers });
console.log('Status:', response.status); // Should be 200
```

### Patch Status

The Futuur authentication patch is automatically applied when:
- MCP Framework version < 0.2.14
- Tools extend `FutuurBaseTool` (recommended)

Look for these log messages:
```
[PATCH] MCP Framework 0.2.13 detected - applying Futuur auth patch
[PATCH] Futuur authentication patch applied successfully
```

### Known Issues

1. **MCP Framework 0.2.13**: Authentication headers are stripped/modified
   - **Solution**: Automatic patch applied via `FutuurBaseTool`
   - **Status**: Temporary workaround until framework is fixed

2. **Missing Environment Variables**: API keys not loaded
   - **Solution**: Ensure `.env` file exists with correct keys
   - **Check**: Startup health check should report the issue

3. **Network Connectivity**: Cannot reach Futuur API
   - **Solution**: Check internet connection and firewall settings
   - **Test**: Manual `curl` request to verify connectivity

### Getting Help

If you continue experiencing issues:
1. Check the startup health check output
2. Verify your API keys in the Futuur dashboard
3. Test authentication manually outside MCP
4. Report issues with full logs and MCP Framework version 