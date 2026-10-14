import { ethers } from "ethers";
import { evmG2ToNoble, hexStringToBigInt, nobleG2ToEvm, validateBlsParams } from "../utils/utils";
import type { BlsParams } from "../types/types";
import { OPNVOTE_ABI } from "../client/abi";
import { rpcProvider, withTimeout } from "../client/utils";
import { generateKeyPair, generateKeyPairRaw, signDummyToken, validateKeyPair } from "./generateKeyPair";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import type { Configuration, ElectionKeys, RegisterKeys, Result } from "./types";

const BLS_VERIFIER_ABI = ["function verify(bytes message, bytes signature, bytes publicKey) view returns (bool)"];

/**
 * Generates election keys
 * @returns Election key pair
 */
export async function generateElectionKeys(): Promise<ElectionKeys> {
    return generateKeyPair();
}

/**
 * Generates register keys
 * @returns Register key pair
 */
export function generateRegisterKeys(): RegisterKeys {
    const { pk, sk } = generateKeyPairRaw();
    return {
        publicKey: nobleG2ToEvm(pk),
        secretKey: "0x" + sk!.toString(16).padStart(64, "0"),
    };
}

/**
 * Verifies election keys
 * @param keys - Election key pair
 * @returns KEY_INVALID if key is invalid or malformed
 */
export async function verifyElectionKeys(keys: ElectionKeys): Promise<Result<void>> {
    try {
        await validateKeyPair(keys.publicKey, keys.privateKey);
    } catch (e) {
        return { ok: false, code: ErrorCode.KEY_INVALID, error: `invalid election keys: ${String(e)}` };
    }
    return { ok: true, value: undefined };
}

/**
 * Verifies register keys against BLS verifier contract
 * @param config - Admin client config
 * @param keys - Register key pair
 * @returns KEY_INVALID if key is invalid or malformed; KEY_VERIFY_FAILED if on-chain verification rejects key
 */
export async function verifyRegisterKeys(config: Configuration, keys: RegisterKeys): Promise<Result<void>> {
    let signed: { message: string; signature: string };

    try {
        const blsParams: BlsParams = { pk: evmG2ToNoble(keys.publicKey), sk: hexStringToBigInt(keys.secretKey) };
        validateBlsParams(blsParams);
        signed = signDummyToken(blsParams);
    } catch (e) {
        return { ok: false, code: ErrorCode.KEY_INVALID, error: `invalid register key: ${String(e)}` };
    }

    const { message, signature } = signed;
    const wrongMessage = message.slice(0, -1) + (message.endsWith("0") ? "1" : "0");

    let valid: boolean;
    let forged: boolean;
    try {
        const provider = rpcProvider(config.rpcUrl, config.chain.id);
        const opnvote = new ethers.Contract(config.contracts.opnvote, OPNVOTE_ABI, provider);
        const verifier = new ethers.Contract(await withTimeout(opnvote.BLS_VERIFIER()), BLS_VERIFIER_ABI, provider);

        [valid, forged] = await withTimeout(
            
            Promise.all([
                verifier.verify(message, signature, keys.publicKey),
                verifier.verify(wrongMessage, signature, keys.publicKey),
            ]),
        );
    } catch (e) {
        
        if (ethers.isError(e, "CALL_EXCEPTION") && e.reason) {
            return { ok: false, code: ErrorCode.KEY_VERIFY_FAILED, error: `on-chain verifier reverted: ${e.reason}` };
        }

        return {
            ok: false,
            code: ErrorCode.RPC_NETWORK,
            error: `on-chain verification failed: ${String(e)}`,
            retryAfterMs: RETRY_AFTER_MS,
        };
    }

    if (!valid) {
        return { ok: false, code: ErrorCode.KEY_VERIFY_FAILED, error: "on-chain verifier rejected a valid signature" };
    }
    
    if (forged) {
        return { ok: false, code: ErrorCode.KEY_VERIFY_FAILED, error: "on-chain verifier did not reject a wrong signature" };
    }

    return { ok: true, value: undefined };
}
