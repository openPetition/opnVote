import { fetchWithTimeout } from "../client/utils";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import type { Ap, Configuration, Register, Result } from "./types";

/**
 *
 * Fetches registers or APs from subgraph
 *
 * @param config - Admin client config
 * @param query - GraphQL query
 * @returns registers/aps sorted by ID or error code
 */
async function querySubgraph(config: Configuration, query: string): Promise<Result<(Register | Ap)[]>> {
    if (!config.endpoints?.subgraphUrl) throw new Error("endpoints.subgraphUrl is not defined");

    let res: Response;
    try {
        res = await fetchWithTimeout(config.endpoints.subgraphUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });
    } catch (e) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `network error: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (!res.ok) {
        const error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        const retryable = res.status >= 500 || res.status === 429;
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error, retryAfterMs: retryable ? RETRY_AFTER_MS : undefined };
    }

    const json = await res.json().catch(() => undefined);
    const items = json?.data?.items;

    if (!Array.isArray(items)) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `response is empty: ${JSON.stringify(json?.errors)}`, retryAfterMs: RETRY_AFTER_MS };
    }
    const sorted = items.map((item) => ({ ...item, id: Number(item.id) })).sort((a, b) => a.id - b.id);
    return { ok: true, value: sorted };
}

/**
 * Fetch registers
 *
 * @param config - Admin client config
 * @returns registers sorted by ID or error code
 */
export function getRegisters(config: Configuration): Promise<Result<Register[]>> {
    return querySubgraph(config, "{ items: registers(first: 100) { id name: registerName uri: registerUri owner } }");
}

/**
 * Fetch APs
 *
 * @param config - Admin client config
 * @returns APs sorted by ID or error code
 */
export function getAps(config: Configuration): Promise<Result<Ap[]>> {
    return querySubgraph(config, "{ items: authorizationProviders(first: 100) { id name: apName uri: apUri owner } }");
}
