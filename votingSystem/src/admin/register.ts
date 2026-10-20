import { evmG2ToNoble, hexStringToBigInt, validateBlsParams, validateElectionID, validateEthSignature } from "../utils/utils";
import { fetchWithTimeout } from "../client/utils";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import type { Configuration, Result, SetRegisterKeysBackendParams } from "./types";

/**
 * Creates messages to be signed to allow the register backend to set the register keys
 *
 * @param electionID - election ID
 * @param publicKey - register public key (evm format)
 * @returns message to sign
 * @throws if pub key format is invalid
 */
export function createRegisterKeysMessage(electionID: number, publicKey: string): string {
    return `Insert register key for election ${electionID} with pk=${evmG2ToNoble(publicKey)}`;
}

/**
 * Sets register keys in backend for a specified election ID
 *
 * @param config - Admin client config
 * @param params - election ID, register keys, signature
 * @returns ok or error code
 */
export async function setRegisterKeysBackend(config: Configuration, params: SetRegisterKeysBackendParams): Promise<Result<void>> {
    if (!config.endpoints?.registerUrl) throw new Error("endpoints.registerUrl is not defined");

    let pk: string;
    try {
        validateElectionID(params.electionID);
        validateEthSignature({ hexString: params.signature });

        pk = evmG2ToNoble(params.keys.publicKey);
        validateBlsParams({ pk, sk: hexStringToBigInt(params.keys.secretKey) });

    } catch (e) {
        return { ok: false, code: ErrorCode.REG_REJECTED, error: `failed to validate request: ${String(e)}` };
    }

    let res: Response;

    try {
        res = await fetchWithTimeout(`${config.endpoints.registerUrl}/api/admin/keys`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ electionId: params.electionID, pk, sk: params.keys.secretKey, signature: params.signature }),
        });
    } catch (e) {
        return { ok: false, code: ErrorCode.REG_NETWORK, error: `network error: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (!res.ok) {

        const error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        return res.status >= 500 || res.status === 429
            ? { ok: false, code: ErrorCode.REG_NETWORK, error, retryAfterMs: RETRY_AFTER_MS }
            : { ok: false, code: ErrorCode.REG_REJECTED, error };
    }

    return { ok: true, value: undefined };
}
