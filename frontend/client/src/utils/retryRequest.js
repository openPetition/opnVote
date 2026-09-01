const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1500;

const wait = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs));

export async function retryRequest(
    request,
    {
        maxRetries = DEFAULT_MAX_RETRIES,
        initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    } = {},
) {
    let result = await request();

    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        if (result.ok || !result.retryable) {
            return result;
        }

        await wait(initialDelayMs * (2 ** retryCount));
        result = await request();
    }

    return result;
}
