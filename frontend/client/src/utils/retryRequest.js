const wait = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs));

export async function retryRequest(
    request,
) {
    const maxRetries = 3;
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
