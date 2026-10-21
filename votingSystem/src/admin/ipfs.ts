import { serializeElectionIpfsData, validateEthSignature } from "../utils/utils";
import { fetchWithTimeout } from "../client/utils";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import type { Author, Configuration, ElectionIpfsData, PinElectionParams, PinnedElection, Result } from "./types";

export const MIN_QUESTIONS = 2;

/**
 *
 * List allowed authors
 *
 * @param config - Admin client config
 * @returns allowed authors or error code
 */
export async function getAllowedAuthors(config: Configuration): Promise<Result<Author[]>> {
    if (!config.endpoints?.ipfsUrl) throw new Error("endpoints.ipfsUrl is not defined");

    let res: Response;
    try {
        res = await fetchWithTimeout(`${config.endpoints.ipfsUrl}/authors`, {});
    } catch (e) {
        return { ok: false, code: ErrorCode.PIN_NETWORK, error: `network error: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (!res.ok) {
        const error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        return res.status >= 500 || res.status === 429
            ? { ok: false, code: ErrorCode.PIN_NETWORK, error, retryAfterMs: RETRY_AFTER_MS }
            : { ok: false, code: ErrorCode.PIN_REJECTED, error };
    }

    const authors = await res.json().catch(() => undefined);

    if (!Array.isArray(authors)) {
        return { ok: false, code: ErrorCode.PIN_NETWORK, error: "no authors in response", retryAfterMs: RETRY_AFTER_MS };
    }
    return { ok: true, value: authors };
}

/**
 * 
 * Creates the serialized message to be pinned
 * 
 * @param ipfsData - Election IPFS data
 * @returns serialized message that should be pinned
 * @throws if election data is malformed or does not have the minimum amount of questions
 */
export function createPinMessage(ipfsData: ElectionIpfsData): string {
    if (ipfsData.questions.length < MIN_QUESTIONS) {
        throw new Error(`specify at least ${MIN_QUESTIONS} questions`);
    }
    return serializeElectionIpfsData(ipfsData);
}

/**
 * 
 * Pins election data to ipfs
 * 
 * @param config - Admin client config
 * @param params - Election IPFS data and signature
 * @returns Result with CID and author or error code
 */
export async function pinElection(
    config: Configuration,
    params: PinElectionParams,
): Promise<Result<PinnedElection>> {
    if (!config.endpoints?.ipfsUrl) throw new Error("endpoints.ipfsUrl is not defined");

    let message: string;
    try {
        message = createPinMessage(params.ipfsData);
        validateEthSignature({ hexString: params.signature });
    } catch (e) {
        return { ok: false, code: ErrorCode.PIN_REJECTED, error: `invalid pin request: ${String(e)}` };
    }

    let res: Response;
    try {
        res = await fetchWithTimeout(`${config.endpoints.ipfsUrl}/pinElectionData`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ electionData: JSON.parse(message), signature: params.signature }),
        });
    } catch (e) {
        return { ok: false, code: ErrorCode.PIN_NETWORK, error: `network error: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (!res.ok) {
        const error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        return res.status >= 500 || res.status === 429
            ? { ok: false, code: ErrorCode.PIN_NETWORK, error, retryAfterMs: RETRY_AFTER_MS }
            : { ok: false, code: ErrorCode.PIN_REJECTED, error };
    }

    const json = (await res.json().catch(() => undefined)) as Partial<PinnedElection> | undefined;

    if (!json?.cid || !json.authorWalletAddress || !json.author) {
        return { ok: false, code: ErrorCode.PIN_NETWORK, error: "no cid or author in response", retryAfterMs: RETRY_AFTER_MS };
    }
    return { ok: true, value: { cid: json.cid, authorWalletAddress: json.authorWalletAddress, author: json.author } };
}
