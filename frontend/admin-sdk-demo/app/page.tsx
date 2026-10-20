"use client";

import { useEffect, useState, type ChangeEvent, type CSSProperties } from "react";
import { createAdminClient, ErrorCode } from "votingsystem/admin";
import type { Ap, Author, CreateElectionParams, ElectionIpfsData, ElectionKeys, ElectionOnChain, ElectionStatusChangeParams, PreparedTx, Register, RegisterKeys, Result } from "votingsystem/admin";
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
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL;

if (!RPC_PROVIDER) {
    throw new Error("NEXT_PUBLIC_RPC_PROVIDER is not defined");
}

if (!OPNVOTE_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_OPNVOTE_CONTRACT_ADDRESS is not defined");
}

if (!IPFS_SERVER_URL) {
    throw new Error("NEXT_PUBLIC_IPFS_SERVER_URL is not defined");
}

if (!SUBGRAPH_URL) {
    throw new Error("NEXT_PUBLIC_SUBGRAPH_URL is not defined");
}

const admin = createAdminClient({
    endpoints: { ipfsUrl: IPFS_SERVER_URL, subgraphUrl: SUBGRAPH_URL },
    contracts: { opnvote: OPNVOTE_CONTRACT_ADDRESS as `0x${string}` },
    rpcUrl: RPC_PROVIDER,
    chain: gnosis,
});

type Role = "create" | "manage" | "register";

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

const DEFAULT_IPFS_FORM: IpfsForm = {
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

type ElectionForm = {
    electionID: string;
    cid: string;
    publicKey: string;
    votingStart: string;
    votingEnd: string;
    registrationStart: string;
    registrationEnd: string;
    registerID: string;
    apID: string;
};

const DEFAULT_ELECTION_FORM: ElectionForm = {
    electionID: "0",
    cid: "",
    publicKey: "",
    votingStart: "",
    votingEnd: "",
    registrationStart: DEFAULT_IPFS_FORM.registrationStart,
    registrationEnd: DEFAULT_IPFS_FORM.registrationEnd,
    registerID: "",
    apID: "",
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

function fromUnixTs(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
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

function toElectionParams(form: ElectionForm, from: Address): CreateElectionParams {
    return {
        from,
        electionID: Number(form.electionID),
        cid: form.cid,
        publicKey: form.publicKey,
        votingStartTime: toUnixTs(form.votingStart),
        votingEndTime: toUnixTs(form.votingEnd),
        registrationStartTime: toUnixTs(form.registrationStart),
        registrationEndTime: toUnixTs(form.registrationEnd),
        registerID: Number(form.registerID),
        apID: Number(form.apID),
    };
}

async function waitFor<T>(request: () => Promise<Result<T>>): Promise<T> {
    for (let i = 0; i < 40; i++) {
        const res = await request();
        if (res.ok || !res.retryAfterMs) return checkResult(res);
        await new Promise((resolve) => setTimeout(resolve, res.retryAfterMs));
    }
    throw new Error("transaction not confirmed after 2 minutes");
}

function walletClient() {
    if (!window.ethereum) throw new Error("no browser wallet found");
    return createWalletClient({ transport: custom(window.ethereum) });
}

export default function Home() {
    const [role, setRole] = useState<Role>("create");
    const [electionKeys, setElectionKeys] = useState<ElectionKeys | null>(null);
    const [registerKeys, setRegisterKeys] = useState<RegisterKeys | null>(null);
    const [ipfsForm, setIpfsForm] = useState<IpfsForm>(DEFAULT_IPFS_FORM);
    const [account, setAccount] = useState<Address | null>(null);
    const [authors, setAuthors] = useState<Result<Author[]> | null>(null);
    const [cid, setCid] = useState<string | null>(null);
    const [electionForm, setElectionForm] = useState<ElectionForm>(DEFAULT_ELECTION_FORM);
    const [registers, setRegisters] = useState<Result<Register[]> | null>(null);
    const [aps, setAps] = useState<Result<Ap[]> | null>(null);
    const [coordinator, setCoordinator] = useState<Result<Address> | null>(null);
    const [electionID, setElectionID] = useState<number | null>(null);
    const [manageID, setManageID] = useState("");
    const [election, setElection] = useState<ElectionOnChain | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [unlocked, setUnlocked] = useState(false);

    useEffect(() => {
        admin.getAllowedAuthors().then(setAuthors);
        admin.getRegisters().then(setRegisters);
        admin.getAps().then(setAps);
        admin.getElectionCoordinator().then(setCoordinator);
    }, []);

    useEffect(() => {
        const ethereum = window.ethereum;
        if (!ethereum) return;
        const onAccountsChanged = (accounts: Address[]) => setAccount(accounts[0] ?? null);
        ethereum.request({ method: "eth_accounts" }).then(onAccountsChanged);
        ethereum.on("accountsChanged", onAccountsChanged);
        return () => ethereum.removeListener("accountsChanged", onAccountsChanged);
    }, []);

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
        add(`${label}`);
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
            updateElectionForm({ publicKey: keys.publicKey });
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

    const updateElectionForm = (patch: Partial<ElectionForm>) => setElectionForm((form) => ({ ...form, ...patch }));

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
            setCid(pinned.cid);
            updateElectionForm({ cid: pinned.cid, registrationStart: ipfsForm.registrationStart, registrationEnd: ipfsForm.registrationEnd });
            add(`CID: ${pinned.cid} (Author: ${pinned.author}, Wallet: ${pinned.authorWalletAddress})`);
        });

    const createElection = () =>
        withBusy(async () => {
            const tx = await step("Creating election publish transaction", async () =>
                checkResult(await admin.createElection(toElectionParams(electionForm, account!))));
            if (!tx) return;
            const txHash = await step("Sending transaction", () => walletClient().sendTransaction({ account: account!, chain: gnosis, ...tx }));
            if (!txHash) return;
            add(`Transaction hash: ${txHash}`);
            const id = await step("Waiting for election ID", () => waitFor(() => admin.getElectionID(txHash)));
            if (id === null) return;
            setElectionID(id);
            setManageID(String(id));
            add(`Election ID: ${id}`);
        });

    async function getElection(id: number) {
        const state = await step(`Loading election ${id}`, async () => checkResult(await admin.getElection(id)));
        setElection(state);
    }

    const loadElection = () => withBusy(() => getElection(Number(manageID)));

    const changeStatus = (label: string, prepareStatusChangeTransaction: (params: ElectionStatusChangeParams) => Promise<Result<PreparedTx>>) =>
        withBusy(async () => {

            const id = election!.electionID;
            const tx = await step(`Creating ${label} transaction`, async () => checkResult(await prepareStatusChangeTransaction({ from: account!, electionID: id })));
            if (!tx) return;
            
            const txHash = await step("Sending transaction", () => walletClient().sendTransaction({ account: account!, chain: gnosis, ...tx }));
            if (!txHash) return;

            add(`Transaction hash: ${txHash}`);
            const confirmed = await step("Waiting for confirmation", () => waitFor(() => admin.getTransactionStatus(txHash)));
            if (confirmed === null) return;

            await getElection(id);
        });

    const now = Date.now() / 1000;
    const canStart = election?.status === "Pending" && election.registerPublicKey !== "0x"
        && now >= election.votingStartTime && now < election.votingEndTime;
    const canEnd = (election?.status === "Pending" || election?.status === "Active")
        && now >= election.votingEndTime;
    const pinned = cid !== null;
    const prefillLocked = !pinned || !unlocked;
    const canPublish = pinned && electionForm.votingStart && electionForm.votingEnd && electionForm.registerID && electionForm.apID;

    const isCoordinator = coordinator?.ok && coordinator.value.toLowerCase() === account?.toLowerCase();
    const isAllowed = authors?.ok && authors.value.some((a) => a.walletAddress.toLowerCase() === account?.toLowerCase());

    const coordinatorInfo = (
        <div style={{ borderTop: "1px solid #ddd", paddingTop: "1rem", marginBottom: "0.5rem", fontSize: 13 }}>
            Election coordinator:
            {!coordinator && " loading"}
            {coordinator && !coordinator.ok && ` ${coordinator.code}: ${coordinator.error}`}
            {coordinator?.ok && ` ${coordinator.value}`}
        </div>
    );

    const accountInfo = (
        <span style={{ fontSize: 13 }}>
            {account} {coordinator?.ok && (isCoordinator ? "✓ election coordinator" : "✗ not election coordinator")}
        </span>
    );

    const btn = { padding: "0.4rem 0.8rem", fontSize: 14 };
    const row: CSSProperties = { display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" };
    const input: CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: "0.3rem", fontSize: 14 };

    const field = (label: string, value: string, onChange: (value: string) => void, type = "text", locked = false) => (
        <label style={{ display: "block", flex: 1, fontSize: 14, marginBottom: "0.5rem" }}>
            {label}
            <input type={type} value={value} disabled={busy || locked} onChange={(e) => onChange(e.target.value)} style={input} />
        </label>
    );

    const select = (label: string, value: string, items: Result<{ id: number; name: string }[]> | null, onChange: (value: string) => void, locked = false) => (
        <label style={{ display: "block", flex: 1, fontSize: 14, marginBottom: "0.5rem" }}>
            {label} {items && !items.ok && `(${items.code}: ${items.error})`}
            <select value={value} disabled={busy || locked || !items?.ok} onChange={(e) => onChange(e.target.value)} style={input}>
                <option value="">— select —</option>
                {items?.ok && items.value.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} (ID {item.id})</option>
                ))}
            </select>
        </label>
    );

    return (
        <main style={{ fontFamily: "sans-serif", maxWidth: 760, margin: "2rem auto", padding: "0 1rem" }}>
            <h1>opn.vote admin SDK demo</h1>

            <div style={row}>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ padding: "0.4rem", fontSize: 14 }}>
                    <option value="create">Election Coordinator: Create Election</option>
                    <option value="manage">Election Coordinator: Manage Election</option>
                    <option value="register">Register</option>
                </select>
                <span style={{ fontSize: 13, color: "#555" }}>
                    opnvote: {OPNVOTE_CONTRACT_ADDRESS}
                </span>
            </div>

            {role === "create" && (
                <section>
                    <p style={{ fontSize: 14, background: "#f4f4f4", border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem" }}>
                        <b>FLOW:</b> 1. Generate election keys → 2. Pin election description to IPFS → 3. Publish election on-chain → 4. Manage election in "Manage Election" tab
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

                    <div style={{ borderTop: "1px solid #ddd", paddingTop: "1rem", marginBottom: "0.5rem", fontSize: 13 }}>
                        Allowed authors:
                        {!authors && " loading"}
                        {authors && !authors.ok && ` ${authors.code}: ${authors.error}`}
                        {authors?.ok && (
                            <ul style={{ margin: "0.25rem 0" }}>
                                {authors.value.map((a) => (
                                    <li key={a.walletAddress}>{a.name} · {a.walletAddress}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div style={row}>
                        {account ? (
                            <>
                                <span style={{ fontSize: 13 }}>
                                    {account} {authors?.ok && (isAllowed ? "✓ allowed" : "✗ not allowed")}
                                </span>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={pinElection}>pinElection</button>
                            </>
                        ) : (
                            <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={connectWallet}>connect wallet to pin</button>
                        )}
                    </div>

                    <h2 style={{ fontSize: 18 }}>3. Publish election on-chain</h2>
                    <label style={{ display: "block", fontSize: 14, marginBottom: "0.5rem" }}>
                        <input type="checkbox" checked={unlocked} disabled={busy || !pinned} onChange={(e) => setUnlocked(e.target.checked)} />{" "}
                        edit all fields
                    </label>
                    <div style={row}>
                        {field("election ID (0 = next unused ID)", electionForm.electionID, (electionID) => updateElectionForm({ electionID }), "number", prefillLocked)}
                        {field("CID", electionForm.cid, (cid) => updateElectionForm({ cid }), "text", prefillLocked)}
                    </div>
                    {field("election public key", electionForm.publicKey, (publicKey) => updateElectionForm({ publicKey }), "text", prefillLocked)}
                    <div style={row}>
                        {field("registration start", electionForm.registrationStart, (registrationStart) => updateElectionForm({ registrationStart }), "datetime-local", prefillLocked)}
                        {field("registration end", electionForm.registrationEnd, (registrationEnd) => updateElectionForm({ registrationEnd }), "datetime-local", prefillLocked)}
                    </div>
                    <div style={row}>
                        {field("voting start", electionForm.votingStart, (votingStart) => updateElectionForm({ votingStart }), "datetime-local", !pinned)}
                        {field("voting end", electionForm.votingEnd, (votingEnd) => updateElectionForm({ votingEnd }), "datetime-local", !pinned)}
                    </div>
                    <div style={row}>
                        {select("register", electionForm.registerID, registers, (registerID) => updateElectionForm({ registerID }), !pinned)}
                        {select("AP", electionForm.apID, aps, (apID) => updateElectionForm({ apID }), !pinned)}
                    </div>
                    {coordinatorInfo}
                    <div style={row}>
                        {account ? (
                            <>
                                {accountInfo}
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canPublish} onClick={createElection}>createElection</button>
                            </>
                        ) : (
                            <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={connectWallet}>connect wallet to publish</button>
                        )}
                    </div>
                </section>
            )}

            {role === "manage" && (
                <section>
                    <h2 style={{ fontSize: 18 }}>Manage election</h2>
                    <div style={row}>
                        {field("election ID", manageID, setManageID, "number")}
                        <button style={btn} disabled={busy || !manageID} onClick={loadElection}>getElection</button>
                    </div>
                    {election && (
                        <ul style={{ fontSize: 14, margin: "0 0 1rem" }}>
                            <li>
                                election {election.electionID}: <b>{election.status}</b>
                            </li>
                            <li>voting: {fromUnixTs(election.votingStartTime)} – {fromUnixTs(election.votingEndTime)}</li>
                            <li>CID: {election.cid}</li>
                            <li>register ID: {election.registerID} · AP ID: {election.apID} · register key: {election.registerPublicKey !== "0x" ? "✓ set" : "✗ missing"}</li>
                            <li>votes: {election.totalVotes}</li>
                        </ul>
                    )}
                    {coordinatorInfo}
                    {account ? (
                        <>
                            <div style={{ marginBottom: "0.5rem" }}>{accountInfo}</div>
                            <div style={row}>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canStart} onClick={() => changeStatus("start", admin.startElection)}>start Election</button>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canEnd} onClick={() => changeStatus("end", admin.endElection)}>end Election</button>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled>tally Election</button>
                            </div>
                        </>
                    ) : (
                        <div style={row}>
                            <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={connectWallet}>connect wallet to manage</button>
                        </div>
                    )}
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
                election keys: {electionKeys ? "✓" : "—"} · register keys: {registerKeys ? "✓" : "—"} · CID: {cid ?? "—"} · election ID: {electionID ?? "—"}
            </div>

            <pre style={{ background: "#f4f4f4", padding: "1rem", whiteSpace: "pre-wrap", borderRadius: 6, minHeight: 120 }}>
                {log.length ? log.join("\n") : ""}
            </pre>
        </main>
    );
}
