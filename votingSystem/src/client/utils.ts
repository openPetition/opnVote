import { ethers } from "ethers";

export const REQUEST_TIMEOUT_MS = 15_000;

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function rpcProvider(rpcUrl: string, chainId: number): ethers.JsonRpcProvider {
    const req = new ethers.FetchRequest(rpcUrl);
    req.timeout = REQUEST_TIMEOUT_MS;
    const network = ethers.Network.from(chainId);
    return new ethers.JsonRpcProvider(req, network, { staticNetwork: network });
}

export async function withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`rpc timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
    });
    try {
        return await Promise.race([p, timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

export async function fetchWithTimeout(url: string, params: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, { ...params, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}
