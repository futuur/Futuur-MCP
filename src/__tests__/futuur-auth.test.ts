import { buildAuthHeaders, fetchFromFutuur } from '../utils/api';

// Mock environment variables for testing
const mockEnv = {
  FUTUUR_PUBLIC_KEY: 'test_public_key_7fc9978a22278299786c10fd10daefcb20d29f9b',
  FUTUUR_PRIVATE_KEY: 'test_private_key_for_testing_purposes_only'
};

describe('Futuur Authentication', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    // Backup original environment
    originalEnv = { ...process.env };
    
    // Set test environment variables
    Object.assign(process.env, mockEnv);
    
    // Mock fetch
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore original fetch
    fetchSpy.mockRestore();
  });

  test('should generate valid auth headers', () => {
    const payload = { outcome: 123, amount: 100 };
    const headers = buildAuthHeaders(payload);
    
    expect(headers).toHaveProperty('Key');
    expect(headers).toHaveProperty('Timestamp');
    expect(headers).toHaveProperty('HMAC');
    expect(headers.Key).toBe(mockEnv.FUTUUR_PUBLIC_KEY);
    expect(headers.HMAC).toMatch(/^[a-f0-9]{128}$/); // SHA-512 hex digest
  });

  test('should inject auth headers for authenticated endpoints via fetchFromFutuur', async () => {
    // Mock successful response
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });

    // Test authenticated endpoint through helper
    await fetchFromFutuur('bets/simulate_purchase/', {
      params: { outcome: 502037, currency: 'OOM', position: 'l', amount: 100 }
    });

    // Verify fetch was called with auth headers
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('bets/simulate_purchase'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Key: mockEnv.FUTUUR_PUBLIC_KEY,
          Timestamp: expect.any(String),
          HMAC: expect.stringMatching(/^[a-f0-9]{128}$/)
        })
      })
    );
  });

  test('should not inject auth headers for public endpoints', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] })
    });

    // Test public endpoint
    await fetchFromFutuur('questions/', {
      params: { limit: 10 }
    });

    // Verify no auth headers were added (only User-Agent)
    const callArgs = fetchSpy.mock.calls[0][1];
    expect(callArgs?.headers || {}).not.toHaveProperty('Key');
    expect(callArgs?.headers || {}).not.toHaveProperty('HMAC');
    expect(callArgs?.headers || {}).toHaveProperty('User-Agent');
  });

  test('should sign GET query params correctly', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });

    // Test with GET request containing query parameters
    await fetchFromFutuur('bets/simulate_purchase/', {
      params: { outcome: 502037, currency: 'OOM', position: 'l', amount: 100 }
    });

    // Verify that the HMAC was calculated with the actual query parameters
    const callArgs = fetchSpy.mock.calls[0][1];
    expect(callArgs?.headers).toHaveProperty('Key');
    expect(callArgs?.headers).toHaveProperty('HMAC');
    
    // The HMAC should be different from an empty payload HMAC
    const emptyPayloadHeaders = buildAuthHeaders({});
    const actualHeaders = callArgs?.headers;
    expect(actualHeaders?.HMAC).not.toBe(emptyPayloadHeaders.HMAC);
  });

  test('should sign POST body correctly', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 123 })
    });

    const postBody = { outcome: 502037, amount: 100, currency: 'OOM', position: 'l' };

    // Test POST request with body
    await fetchFromFutuur('bets/', {
      method: 'POST',
      body: postBody
    });

    // Verify auth headers were generated based on POST body
    const callArgs = fetchSpy.mock.calls[0][1];
    expect(callArgs?.headers).toHaveProperty('Key');
    expect(callArgs?.headers).toHaveProperty('HMAC');
    expect(callArgs?.headers).toHaveProperty('Content-Type', 'application/json');

    // Verify body was stringified
    expect(callArgs?.body).toBe(JSON.stringify(postBody));
  });

  test('should handle errors gracefully', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });

    await expect(
      fetchFromFutuur('me')
    ).rejects.toThrow(/Futuur API 403/);
  });
}); 