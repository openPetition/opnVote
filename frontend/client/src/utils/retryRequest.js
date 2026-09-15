const DEFAULT_MAX_RETRIES = 3;

const wait = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs));

export async function retryRequest(
    request,
    {
        maxRetries = DEFAULT_MAX_RETRIES,
    } = {},
) {
    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        const result = await request();
        const retryAfterMs = result.ok ? undefined : result.retryAfterMs;

        if (
            result.ok
            || typeof retryAfterMs !== 'number'
            || retryCount === maxRetries
        ) {
            return result;
        }

        await wait(retryAfterMs);
    }
}
