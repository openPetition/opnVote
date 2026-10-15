"use client";

import { useState, type ChangeEvent, type CSSProperties } from "react";
import { createAdminClient, ErrorCode } from "votingsystem/admin";
import type { ElectionKeys, RegisterKeys, Result } from "votingsystem/admin";
import { gnosis } from "viem/chains";


const RPC_PROVIDER = process.env.NEXT_PUBLIC_RPC_PROVIDER;
const OPNVOTE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_OPNVOTE_CONTRACT_ADDRESS;

if (!RPC_PROVIDER) {
    throw new Error("NEXT_PUBLIC_RPC_PROVIDER is not defined");
}

if (!OPNVOTE_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_OPNVOTE_CONTRACT_ADDRESS is not defined");
}

const admin = createAdminClient({ contracts: { opnvote: OPNVOTE_CONTRACT_ADDRESS as `0x${string}` }, rpcUrl: RPC_PROVIDER, chain: gnosis });

type Role = "coordinator" | "register";


function checkResult(r: Result<void>): true {
    if (r.ok) return true;
    throw new Error(`${r.code}: ${r.error}` + (r.retryAfterMs ? ` (retry after ${r.retryAfterMs} ms)` : ""));
}

function download(name: string, keys: ElectionKeys | RegisterKeys) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(keys, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importFile(e: ChangeEvent<HTMLInputElement>): File | undefined {
    const file = e.target.files?.[0];
    e.target.value = "";
    return file;
}

async function readKeyFile<T>(file: File): Promise<T> {
    try {
        return JSON.parse(await file.text()) as T;
    } catch {
        throw new Error("json not valid");
    }
}

export default function Home() {
    const [role, setRole] = useState<Role>("coordinator");
    const [electionKeys, setElectionKeys] = useState<ElectionKeys | null>(null);
    const [registerKeys, setRegisterKeys] = useState<RegisterKeys | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    const add = (line: string) => setLog((prev) => [...prev, line]);
    const replaceLast = (line: string) => setLog((prev) => [...prev.slice(0, -1), line]);

    async function withBusy(fn: () => void | Promise<void>) {
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            add("✗ " + String(e));
        } finally {
            setBusy(false);
        }
    }

    async function step<T>(label: string, fn: () => T | Promise<T>): Promise<T | null> {
        add(`${label} …`);
        try {
            const value = await fn();
            replaceLast(`${label} ✓`);
            return value;
        } catch (e) {
            replaceLast(`${label} ✗ ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }

    const verifyElectionKeys = (keys: ElectionKeys) =>
        step("Verifying election keys (locally)", async () => checkResult(await admin.verifyElectionKeys(keys)));

    async function verifyRegisterKeys(keys: RegisterKeys) {
        let result: Result<void> | undefined;
        const local = await step("Verifying register keys (locally)", async () => {
            result = await admin.verifyRegisterKeys(keys);
            return result.ok || result.code !== ErrorCode.KEY_INVALID || checkResult(result);
        });
        if (local) await step("Verifying register keys (on-chain)", () => checkResult(result!));
    }

    const generateElectionKeys = () =>
        withBusy(async () => {
            const keys = await step("Generating election keys", () => admin.generateElectionKeys());
            if (!keys) return;
            setElectionKeys(keys);
            await verifyElectionKeys(keys);
        });

    const verifyElectionKeysFile = (e: ChangeEvent<HTMLInputElement>) =>
        withBusy(async () => {
            const file = importFile(e);
            if (!file) return;
            const keys = await step(`Reading ${file.name}`, () => readKeyFile<ElectionKeys>(file));
            if (keys) await verifyElectionKeys(keys);
        });

    const generateRegisterKeys = () =>
        withBusy(async () => {
            const keys = await step("Generating register keys", () => admin.generateRegisterKeys());
            if (!keys) return;
            setRegisterKeys(keys);
            await verifyRegisterKeys(keys);
        });

    const verifyRegisterKeysFile = (e: ChangeEvent<HTMLInputElement>) =>
        withBusy(async () => {
            const file = importFile(e);
            if (!file) return;
            const keys = await step(`Reading ${file.name}`, () => readKeyFile<RegisterKeys>(file));
            if (keys) await verifyRegisterKeys(keys);
        });

    const btn = { padding: "0.4rem 0.8rem", fontSize: 14 };
    const row: CSSProperties = { display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" };

    return (
        <main style={{ fontFamily: "sans-serif", maxWidth: 760, margin: "2rem auto", padding: "0 1rem" }}>
            <h1>opn.vote admin SDK demo</h1>

            <div style={row}>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ padding: "0.4rem", fontSize: 14 }}>
                    <option value="coordinator">Election Coordinator</option>
                    <option value="register">Register</option>
                </select>
                <span style={{ fontSize: 13, color: "#555" }}>
                    opnvote: {OPNVOTE_CONTRACT_ADDRESS}
                </span>
            </div>

            {role === "coordinator" && (
                <section>
                    <h2 style={{ fontSize: 18 }}>Election keys</h2>
                    <div style={row}>
                        <button style={btn} disabled={busy} onClick={generateElectionKeys}>generateElectionKeys</button>
                        <button style={btn} disabled={busy || !electionKeys} onClick={() => download("election-keys", electionKeys!)}>download</button>
                        <label style={{ fontSize: 14 }}>
                            verifyElectionKeys: <input type="file" accept=".json" disabled={busy} onChange={verifyElectionKeysFile} />
                        </label>
                    </div>
                </section>
            )}

            {role === "register" && (
                <section>
                    <h2 style={{ fontSize: 18 }}>Register keys</h2>
                    <div style={row}>
                        <button style={btn} disabled={busy} onClick={generateRegisterKeys}>generateRegisterKeys</button>
                        <button style={btn} disabled={busy || !registerKeys} onClick={() => download("register-keys", registerKeys!)}>download</button>
                        <label style={{ fontSize: 14 }}>
                            verifyRegisterKeys: <input type="file" accept=".json" disabled={busy} onChange={verifyRegisterKeysFile} />
                        </label>
                    </div>
                </section>
            )}

            <div style={{ fontSize: 13, color: "#555", marginBottom: "0.5rem" }}>
                election keys: {electionKeys ? "✓" : "—"} · register keys: {registerKeys ? "✓" : "—"}
            </div>

            <pre style={{ background: "#f4f4f4", padding: "1rem", whiteSpace: "pre-wrap", borderRadius: 6, minHeight: 120 }}>
                {log.length ? log.join("\n") : ""}
            </pre>
        </main>
    );
}
