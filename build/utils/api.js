// Common API utilities can go here
import crypto from "crypto";
// Global configuration that can be set at app initialization
let apiConfig = {
    publicKey: process.env.FUTUUR_PUBLIC_KEY,
    privateKey: process.env.FUTUUR_PRIVATE_KEY,
};
export function configureFutuurApi(config) {
    apiConfig = {
        ...apiConfig,
        ...config,
    };
}
// Use Node.js crypto
function buildSignature(params, privateKey) {
    const timestamp = Math.floor(Date.now() / 1000);
    // Add key and timestamp to params
    const paramsToSign = {
        ...params,
        Key: apiConfig.publicKey,
        Timestamp: timestamp,
    };
    // Sort params alphabetically
    const sortedParams = Object.keys(paramsToSign)
        .sort()
        .reduce((acc, key) => {
        acc[key] = paramsToSign[key];
        return acc;
    }, {});
    // Convert to URL encoded string
    const paramString = new URLSearchParams(sortedParams).toString();
    // Generate HMAC using Node.js crypto
    // Try with the raw privateKey first
    const hmac = crypto
        .createHmac("sha512", privateKey)
        .update(paramString)
        .digest("hex");
    return { hmac, timestamp };
}
function buildHeaders(params) {
    if (!apiConfig.publicKey || !apiConfig.privateKey) {
        return {};
    }
    const signature = buildSignature(params, apiConfig.privateKey);
    return {
        Key: apiConfig.publicKey,
        Timestamp: signature.timestamp.toString(),
        HMAC: signature.hmac,
    };
}
export async function fetchFromFutuur(endpoint, options = {}) {
    const { params = {}, token, method = "GET", body, useHmac = true } = options;
    const baseUrl = "https://api.futuur.com/api/v1";
    // Determine if this endpoint requires authentication
    const publicEndpoints = ["questions", "categories"];
    const isPublicEndpoint = publicEndpoints.some((prefix) => endpoint.startsWith(prefix) || endpoint === prefix);
    // Build URL with query parameters
    let url = `${baseUrl}/${endpoint}`;
    let queryParams = { ...params };
    // Prepare headers
    let headers = {};
    // Always add User-Agent header
    headers["User-Agent"] = "Mozilla/5.0 (compatible; MyServerBot/1.0; +https://example.com)";
    // Handle authentication
    if (!isPublicEndpoint) {
        if (useHmac && apiConfig.publicKey && apiConfig.privateKey) {
            // Use HMAC authentication
            headers = { ...headers, ...buildHeaders(method.toUpperCase() === "GET" ? queryParams : body || {}) };
        }
        else if (token) {
            // Fallback to token authentication
            headers = { ...headers, Authorization: `Bearer ${token}` };
        }
    }
    // Add content type for requests with body
    if (body) {
        headers["Content-Type"] = "application/json";
    }
    // Build query string
    if (Object.keys(queryParams).length > 0) {
        const searchParams = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined) {
                if (Array.isArray(value)) {
                    value.forEach((v) => searchParams.append(key, v.toString()));
                }
                else {
                    searchParams.append(key, value.toString());
                }
            }
        });
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }
    // Prepare fetch options
    const fetchOptions = {
        method,
        headers,
    };
    if (body) {
        fetchOptions.body = JSON.stringify(body);
    }
    // Make the request
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
        throw new Error(JSON.stringify({ ...fetchOptions, response: response.status, url }));
        // throw new Error(`API request failed with status ${response.status}`);
    }
    return response.json();
}
// Helper for simulating bet purchases
export async function simulateBetPurchase(outcome, amount, currency = "OOM", position = "l") {
    const params = {
        outcome,
        currency,
        position,
    };
    if (amount !== undefined)
        params.amount = amount;
    return fetchFromFutuur("bets/simulate_purchase/", {
        params,
        useHmac: true,
    });
}
