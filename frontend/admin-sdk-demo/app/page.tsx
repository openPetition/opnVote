"use client";

import { useState, type ChangeEvent, type CSSProperties } from "react";
import { createAdminClient, ErrorCode } from "votingsystem/admin";
import type { ElectionIpfsData, ElectionKeys, RegisterKeys, Result } from "votingsystem/admin";
import { createWalletClient, custom, type Address, type EIP1193Provider } from "viem";
import { gnosis } from "viem/chains";

declare global {
    interface Window {
        ethereum?: EIP1193Provider;
    }
}


const RPC_PROVIDER = process.env.NEXT_PUBLIC_RPC_PROVIDER;
const OPNVOTE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_OPNVOTE_CONTRACT_ADDRESS;
const IPFS_SERVER_URL = process.env.NEXT_PUBLIC_IPFS_SERVER_URL;

if (!RPC_PROVIDER) {
    throw new Error("NEXT_PUBLIC_RPC_PROVIDER is not defined");
}

if (!OPNVOTE_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_OPNVOTE_CONTRACT_ADDRESS is not defined");
}

if (!IPFS_SERVER_URL) {
    throw new Error("NEXT_PUBLIC_IPFS_SERVER_URL is not defined");
}

const admin = createAdminClient({
    endpoints: { ipfsUrl: IPFS_SERVER_URL },
    contracts: { opnvote: OPNVOTE_CONTRACT_ADDRESS as `0x${string}` },
    rpcUrl: RPC_PROVIDER,
    chain: gnosis,
});

type Role = "coordinator" | "register";

type IpfsForm = {
    title: string;
    summary: string;
    description: string;
    headerImageLarge: string;
    headerImageSmall: string;
    backLink: string;
    registrationStart: string;
    registrationEnd: string;
    questions: { text: string; imageUrl: string }[];
};

const PREFILL_IPFS_FORM: IpfsForm = {
    title: "Election title",
    summary: "Short summary of the election",
    description: "Full description of the election",
    headerImageLarge: "https://www.opn.vote/sample1_header.png",
    headerImageSmall: "https://www.opn.vote/sample1_header.png",
    backLink: "https://www.opn.vote",
    registrationStart: "2027-01-01T00:00",
    registrationEnd: "2027-01-15T00:00",
    questions: [{ text: "Election question", imageUrl: "https://www.opn.vote/sample1_flower.png" }],
};

function checkResult<T>(r: Result<T>): T {
    if (r.ok) return r.value;
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

function toUnixTs(value: string): number {
    return Math.floor(new Date(value).getTime() / 1000);
}

function toIpfsData(form: IpfsForm): ElectionIpfsData {
    return {
        title: form.title,
        headerImage: { large: form.headerImageLarge, small: form.headerImageSmall },
        description: form.description,
        summary: form.summary,
        questions: form.questions,
        backLink: form.backLink,
        registrationStartTime: toUnixTs(form.registrationStart),
        registrationEndTime: toUnixTs(form.registrationEnd),
    };
}

function walletClient() {
    if (!window.ethereum) throw new Error("no browser wallet found");
    return createWalletClient({ transport: custom(window.ethereum) });
}

export default function Home() {
    const [role, setRole] = useState<Role>("coordinator");
    const [electionKeys, setElectionKeys] = useState<ElectionKeys | null>(null);
    const [registerKeys, setRegisterKeys] = useState<RegisterKeys | null>(null);
    const [ipfsForm, setIpfsForm] = useState<IpfsForm>(PREFILL_IPFS_FORM);
    const [account, setAccount] = useState<Address | null>(null);
    const [cid, setCid] = useState<string | null>(null);
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

    const updateIpfsForm = (patch: Partial<IpfsForm>) => setIpfsForm((form) => ({ ...form, ...patch }));

    const updateQuestion = (i: number, patch: Partial<IpfsForm["questions"][number]>) =>
        updateIpfsForm({ questions: ipfsForm.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

    const connectWallet = () =>
        withBusy(async () => {
            const address = await step("Connecting wallet", async () => (await walletClient().requestAddresses())[0]);
            if (address) setAccount(address);
        });

    const pinElection = () =>
        withBusy(async () => {
            const ipfsData = toIpfsData(ipfsForm);
            const signature = await step(`Signing pin message`, () =>
                walletClient().signMessage({ account: account!, message: admin.createPinMessage(ipfsData) }));
            if (!signature) return;
            const pinned = await step("Pinning election data", async () =>
                checkResult(await admin.pinElection({ ipfsData, signature })));
            if (!pinned) return;
            setCid(pinned);
            add(`CID: ${pinned}`);
        });

    const btn = { padding: "0.4rem 0.8rem", fontSize: 14 };
    const row: CSSProperties = { display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" };
    const input: CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: "0.3rem", fontSize: 14 };

    const field = (label: string, value: string, onChange: (value: string) => void, type = "text") => (
        <label style={{ display: "block", flex: 1, fontSize: 14, marginBottom: "0.5rem" }}>
            {label}
            <input type={type} value={value} disabled={busy} onChange={(e) => onChange(e.target.value)} style={input} />
        </label>
    );

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
                    <p style={{ fontSize: 14, background: "#f4f4f4", border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem" }}>
                        <b>FLOW:</b> 1. Generate election keys → 2. Pin election description to IPFS → 3. Publish election on-chain → 4. Start election / End election / Tally votes
                    </p>
                    <h2 style={{ fontSize: 18 }}>1. Generate Election Keys</h2>
                    <div style={row}>
                        <button style={btn} disabled={busy} onClick={generateElectionKeys}>generateElectionKeys</button>
                        <button style={btn} disabled={busy || !electionKeys} onClick={() => download("election-keys", electionKeys!)}>download</button>
                        <label style={{ fontSize: 14 }}>
                            verifyElectionKeys: <input type="file" accept=".json" disabled={busy} onChange={verifyElectionKeysFile} />
                        </label>
                    </div>

                    <h2 style={{ fontSize: 18 }}>2. Pin election description to IPFS</h2>
                    {field("title", ipfsForm.title, (title) => updateIpfsForm({ title }))}
                    {field("summary", ipfsForm.summary, (summary) => updateIpfsForm({ summary }))}
                    <label style={{ display: "block", fontSize: 14, marginBottom: "0.5rem" }}>
                        description
                        <textarea
                            value={ipfsForm.description}
                            rows={3}
                            disabled={busy}
                            onChange={(e) => updateIpfsForm({ description: e.target.value })}
                            style={input}
                        />
                    </label>
                    <div style={row}>
                        {field("header image large (desktop)", ipfsForm.headerImageLarge, (headerImageLarge) => updateIpfsForm({ headerImageLarge }))}
                        {field("header image small (mobile)", ipfsForm.headerImageSmall, (headerImageSmall) => updateIpfsForm({ headerImageSmall }))}
                    </div>
                    {field("back link", ipfsForm.backLink, (backLink) => updateIpfsForm({ backLink }))}
                    <div style={row}>
                        {field("registration start", ipfsForm.registrationStart, (registrationStart) => updateIpfsForm({ registrationStart }), "datetime-local")}
                        {field("registration end", ipfsForm.registrationEnd, (registrationEnd) => updateIpfsForm({ registrationEnd }), "datetime-local")}
                    </div>
                    {ipfsForm.questions.map((question, i) => (
                        <div key={i} style={row}>
                            {field(`question ${i + 1}`, question.text, (text) => updateQuestion(i, { text }))}
                            {field("image", question.imageUrl, (imageUrl) => updateQuestion(i, { imageUrl }))}
                        </div>
                    ))}
                    <div style={row}>
                        <button style={btn} disabled={busy} onClick={() => updateIpfsForm({ questions: [...ipfsForm.questions, { text: "", imageUrl: "" }] })}>+ question</button>
                        <button style={btn} disabled={busy || ipfsForm.questions.length < 2} onClick={() => updateIpfsForm({ questions: ipfsForm.questions.slice(0, -1) })}>- question</button>
                    </div>

                    <div style={{ ...row, borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
                        {account ? (
                            <>
                                <span style={{ fontSize: 13 }}>{account}</span>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={pinElection}>pinElection</button>
                            </>
                        ) : (
                            <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={connectWallet}>connect wallet to pin</button>
                        )}
                    </div>

                    <h2 style={{ fontSize: 18 }}>3. Publish election on-chain</h2>
                    <p style={{ fontSize: 14, color: "#555" }}>to be implemented</p>

                    <h2 style={{ fontSize: 18 }}>4. Start Election / End Election / Tally Votes</h2>
                    <p style={{ fontSize: 14, color: "#555" }}>to be implemented</p>
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
                election keys: {electionKeys ? "✓" : "—"} · register keys: {registerKeys ? "✓" : "—"} · CID: {cid ?? "—"}
            </div>

            <pre style={{ background: "#f4f4f4", padding: "1rem", whiteSpace: "pre-wrap", borderRadius: 6, minHeight: 120 }}>
                {log.length ? log.join("\n") : ""}
            </pre>
        </main>
    );
}
