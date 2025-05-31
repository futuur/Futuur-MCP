// Common API utilities can go here
import crypto from "crypto";
import dotenv from "dotenv";
// Ensure environment variables are loaded
dotenv.config();
// Legacy global configuration (keeping for backward compatibility)
let apiConfig = {};
// STATELESS AUTH BUILDER - reads env every time, no config persistence issues
export function buildAuthHeaders(payload) {
    // Force reload environment to ensure keys are available
    dotenv.config();
    const key = process.env.FUTUUR_PUBLIC_KEY;
    const secret = process.env.FUTUUR_PRIVATE_KEY;
    if (!key || !secret) {
        throw new Error(`Futuur keys missing in env: key=${!!key}, secret=${!!secret}`);
    }
    const timestamp = Math.floor(Date.now() / 1000);
    // Build signature parameters
    const paramsToSign = {
        ...payload,
        Key: key,
        Timestamp: timestamp,
    };
    // Sort params alphabetically
    const sortedParams = Object.keys(paramsToSign)
        .sort()
        .reduce((acc, paramKey) => {
        acc[paramKey] = paramsToSign[paramKey];
        return acc;
    }, {});
    // Convert to URL encoded string
    const paramString = new URLSearchParams(sortedParams).toString();
    // Generate HMAC
    const hmac = crypto
        .createHmac("sha512", secret)
        .update(paramString)
        .digest("hex");
    console.error('[AUTH] Generated headers for keys:', key.slice(0, 6), 'payload keys:', Object.keys(payload));
    return {
        Key: key,
        Timestamp: timestamp.toString(),
        HMAC: hmac,
    };
}
// Function to get current config, loading from env if not already set
function getCurrentConfig() {
    if (!apiConfig.publicKey || !apiConfig.privateKey) {
        // Force reload environment variables
        dotenv.config();
        apiConfig = {
            publicKey: process.env.FUTUUR_PUBLIC_KEY,
            privateKey: process.env.FUTUUR_PRIVATE_KEY,
        };
        // Debug logging to track when config is loaded
        console.error('[API CONFIG] Loaded keys:', !!apiConfig.publicKey, !!apiConfig.privateKey);
    }
    return apiConfig;
}
// Export for debugging
export function getApiConfig() {
    return { ...getCurrentConfig() };
}
export function configureFutuurApi(config) {
    console.error('[API CONFIG] Explicit configuration called:', !!config.publicKey, !!config.privateKey);
    apiConfig = {
        ...apiConfig,
        ...config,
    };
}
// NEW DEFINITIVE FETCH HELPER - Authentication built-in, no global dependency
export async function fetchFromFutuur(endpoint, { params = {}, method = 'GET', body, } = {}) {
    // ① Compose URL & payload
    const base = 'https://api.futuur.com/api/v1/';
    const url = new URL(endpoint, base);
    // Add query parameters to URL
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, String(v)));
            }
            else {
                url.searchParams.append(key, String(value));
            }
        }
    });
    // Determine payload for signature (what gets signed)
    const signaturePayload = method === 'GET'
        ? Object.fromEntries(url.searchParams.entries())
        : body || {};
    // ② Attach auth headers for every non-public call
    const publicPrefixes = ['questions', 'categories'];
    const isPublic = publicPrefixes.some(prefix => endpoint.startsWith(prefix) || endpoint.includes(`/${prefix}`));
    let headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; MyServerBot/1.0; +https://example.com)'
    };
    if (!isPublic) {
        // Generate auth headers based on actual request payload
        const authHeaders = buildAuthHeaders(signaturePayload);
        headers = { ...headers, ...authHeaders };
        console.error(`[FETCH] Auth headers added for ${endpoint}, payload keys:`, Object.keys(signaturePayload));
    }
    if (method === 'POST' || method === 'PATCH') {
        headers['Content-Type'] = 'application/json';
    }
    // ③ Fire request
    const fetchOptions = {
        method,
        headers,
    };
    if (body && (method === 'POST' || method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(body);
    }
    console.error(`[FETCH] Making ${method} request to ${url.toString()}`);
    const response = await fetch(url.toString(), fetchOptions);
    if (!response.ok) {
        const errorDetails = {
            status: response.status,
            statusText: response.statusText,
            url: url.toString(),
            method,
            headers: Object.keys(headers)
        };
        throw new Error(`Futuur API ${response.status} for ${endpoint}: ${JSON.stringify(errorDetails)}`);
    }
    return response.json();
}
export async function simulateBetPurchase(params) {
    const { outcome, currency = "OOM", position = "l", amount, shares, } = params;
    const apiCallParams = {
        outcome,
        currency,
        position,
    };
    if (amount !== undefined) {
        apiCallParams.amount = amount;
    }
    else if (shares !== undefined) {
        apiCallParams.shares = shares;
    }
    return fetchFromFutuur("bets/simulate_purchase/", {
        params: apiCallParams,
        method: "GET",
    });
}
// Helper for placing bets
export async function placeBet(payload) {
    return fetchFromFutuur("bets/", {
        method: "POST",
        body: payload,
    });
}
