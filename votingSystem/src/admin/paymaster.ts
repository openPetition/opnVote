import { ethers } from "ethers";
import type { Hex } from "viem";
import { validateEthAddress } from "../utils/utils";
import { rpcProvider, withTimeout } from "../client/utils";
import { PAYMASTER_ABI } from "../client/abi";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import type { Configuration, FundPaymasterParams, Paymaster, PreparedTransaction, Result } from "./types";

/**
 * Retrieves deposit and sponsoring rules of the paymaster
 *
 * @param config - Admin client config
 * @returns paymaster or error code
 */
export async function getPaymaster(config: Configuration): Promise<Result<Paymaster>> {
    const paymaster = new ethers.Contract(config.contracts.paymaster, PAYMASTER_ABI, rpcProvider(config.rpcUrl, config.chain.id));

    let values: any[];
    try {
        values = await withTimeout(Promise.all([
            paymaster.OPN_VOTE(),
            paymaster.getDeposit(),
            paymaster.maxOpsPerElection(),
            paymaster.maxCostCap(),
            paymaster.maxFeePerGasCap(),
        ]));
    } catch (e) {
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `couldn't read paymaster: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    const [opnvote, deposit, maxOpsPerElection, maxCostCap, maxFeePerGasCap] = values;

    if (opnvote.toLowerCase() !== config.contracts.opnvote.toLowerCase()) {
        return { ok: false, code: ErrorCode.PAYMASTER_INVALID, error: `paymaster sponsors contract and opnvote contract in config are not matching!` };
    }

    return {
        ok: true,
        value: { deposit, maxOpsPerElection: Number(maxOpsPerElection), maxCostCap, maxFeePerGasCap },
    };
}

/**
 * Creates a transaction to add assets to the paymaster
 *
 * @param config - Admin client config
 * @param params - sender and amount in wei
 * @returns unsigned transaction or error code
 */
export async function fundPaymaster(config: Configuration, params: FundPaymasterParams): Promise<Result<PreparedTransaction>> {
    try {
        validateEthAddress(params.from);
    } catch (e) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: `invalid transaction sender: ${String(e)}` };
    }

    if (typeof params.amount !== "bigint" || params.amount <= 0n) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: `invalid transaction amount` };
    }

    const paymaster = await getPaymaster(config);
    if (!paymaster.ok) return paymaster;

    const data = new ethers.Interface(PAYMASTER_ABI).encodeFunctionData("deposit", []) as Hex;

    return { ok: true, value: { to: config.contracts.paymaster, data, value: params.amount } };
}
