"use client";

import { useEffect, useState, type ChangeEvent, type CSSProperties } from "react";
import { createAdminClient, ErrorCode } from "votingsystem/admin";
import type { Ap, Author, CreateElectionParams, ElectionIpfsData, ElectionKeys, ElectionOnChain, ElectionStatusChangeParams, Paymaster, PreparedTransaction, QuestionResult, Register, RegisterKeys, Result } from "votingsystem/admin";
import { createPublicClient, createWalletClient, custom, formatEther, formatGwei, http, parseEther, type Address, type EIP1193Provider } from "viem";
import { gnosis } from "viem/chains";

declare global {
    interface Window {
        ethereum?: EIP1193Provider;
    }
}


const RPC_PROVIDER = process.env.NEXT_PUBLIC_RPC_PROVIDER;
const OPNVOTE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_OPNVOTE_CONTRACT_ADDRESS;
const PAYMASTER_ADDRESS = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS;
const IPFS_SERVER_URL = process.env.NEXT_PUBLIC_IPFS_SERVER_URL;
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
const REGISTER_URL = process.env.NEXT_PUBLIC_REGISTER_URL;

if (!RPC_PROVIDER) {
    throw new Error("NEXT_PUBLIC_RPC_PROVIDER is not defined");
}

if (!OPNVOTE_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_OPNVOTE_CONTRACT_ADDRESS is not defined");
}

if (!PAYMASTER_ADDRESS) {
    throw new Error("NEXT_PUBLIC_PAYMASTER_ADDRESS is not defined");
}

if (!IPFS_SERVER_URL) {
    throw new Error("NEXT_PUBLIC_IPFS_SERVER_URL is not defined");
}

if (!SUBGRAPH_URL) {
    throw new Error("NEXT_PUBLIC_SUBGRAPH_URL is not defined");
}

const CHAIN = gnosis;

const admin = createAdminClient({
    endpoints: { ipfsUrl: IPFS_SERVER_URL, subgraphUrl: SUBGRAPH_URL, registerUrl: REGISTER_URL },
    contracts: { opnvote: OPNVOTE_CONTRACT_ADDRESS as `0x${string}`, paymaster: PAYMASTER_ADDRESS as `0x${string}` },
    rpcUrl: RPC_PROVIDER,
    chain: CHAIN,
});

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_PROVIDER) });

type Role = "create" | "manage" | "register" | "sponsoring";

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

function formatAmount(wei: bigint | undefined): string {
    return wei === undefined ? "—" : `${formatEther(wei)} xDAI`;
}

function registerKeyStatus(onChainKey: string, keys: RegisterKeys | null): string {

    if (onChainKey === "0x"){
        return "✗ missing";
    }
    
    if (!keys){
        return "✓ already set"
    }
    if (onChainKey.toLowerCase() === keys.publicKey.toLowerCase()){
        return "✓ loaded and on-chain keys match";
    }
    
    return "✗ loaded and on-chain keys are different!";
}

function electionKeyStatus(onChainKey: string, keys: ElectionKeys | null): string {
    if (!keys){
        return "— keys not loaded";
    }

    if (onChainKey.toLowerCase() === keys.publicKey?.toLowerCase()){
        return "✓ loaded and on-chain keys match";
    }
    return "✗ loaded and on-chain keys are different";
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
    const [tallyResults, setTallyResults] = useState<QuestionResult[] | null>(null);
    const [register, setRegister] = useState<Result<Register> | null>(null);
    const [paymaster, setPaymaster] = useState<Result<Paymaster> | null>(null);
    const [balances, setBalances] = useState<Record<string, bigint>>({});
    const [paymasterAmount, setPaymasterAmount] = useState("");
    const [transferAmount, setTransferAmount] = useState("");
    const [log, setLog] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [unlocked, setUnlocked] = useState(false);

    useEffect(() => {
        admin.getAllowedAuthors().then(setAuthors);
        admin.getRegisters().then(setRegisters);
        admin.getAps().then(setAps);
        admin.getElectionCoordinator().then(setCoordinator);
        admin.getPaymaster().then(setPaymaster);
    }, []);

    useEffect(() => {
        const ethereum = window.ethereum;
        if (!ethereum) return;
        const onAccountsChanged = (accounts: Address[]) => setAccount(accounts[0] ?? null);
        ethereum.request({ method: "eth_accounts" }).then(onAccountsChanged);
        ethereum.on("accountsChanged", onAccountsChanged);
        return () => ethereum.removeListener("accountsChanged", onAccountsChanged);
    }, []);

    useEffect(() => {
        if (election) admin.getRegister(election.registerID).then(setRegister);
    }, [election]);

    useEffect(() => {
        loadBalances();
    }, [registers, aps]);

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
            if (!keys) return;
            setRegisterKeys(keys);
            await verifyRegisterKeys(keys);
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
            const txHash = await step("Sending transaction", () => walletClient().sendTransaction({ account: account!, chain: CHAIN, ...tx }));
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

    const loadElection = () =>
        withBusy(async () => {
            setTallyResults(null);
            await getElection(Number(manageID));
        });

    const changeStatus = (label: string, prepareStatusChangeTransaction: (params: ElectionStatusChangeParams) => Promise<Result<PreparedTransaction>>) =>
        withBusy(async () => {

            const id = election!.electionID;
            const tx = await step(`Creating ${label} transaction`, async () => checkResult(await prepareStatusChangeTransaction({ from: account!, electionID: id })));
            if (!tx) return;
            
            const txHash = await step("Sending transaction", () => walletClient().sendTransaction({ account: account!, chain: CHAIN, ...tx }));
            if (!txHash) return;

            add(`Transaction hash: ${txHash}`);
            const confirmed = await step("Waiting for confirmation", () => waitFor(() => admin.getTransactionStatus(txHash)));
            if (confirmed === null) return;

            await getElection(id);
        });

    const loadElectionKeysFile = (e: ChangeEvent<HTMLInputElement>) =>
        
        withBusy(async () => {
            const file = importFile(e);
            if (!file) return;

            const keys = await step(`Reading selected file`, () => readKeyFile<ElectionKeys>(file));
            if (!keys) return;
            
            setElectionKeys(keys);
            await verifyElectionKeys(keys);
        });

    const tallyElection = () =>
        withBusy(async () => {

            const id = election!.electionID;
            const results = await step(`Tallying election ${id}`, async () =>
                checkResult(await admin.tallyElection({ electionID: id, privateKey: electionKeys!.privateKey })));
            if (results) setTallyResults(results);
        });

    const publishResults = () => {
        if (!window.confirm(`Confirm to publish the results for election ${election!.electionID}. Published results cannot be changed!`)) return;

        changeStatus("publish results", (params) =>
            admin.publishElectionResults({ ...params, results: tallyResults!, privateKey: electionKeys!.privateKey }));
    };

    const setRegisterPublicKeyOnChain = () =>
        withBusy(async () => {

            const id = election!.electionID;
            const tx = await step("Creating register key transaction", async () =>
                checkResult(await admin.setRegisterPublicKeyOnChain({ from: account!, electionID: id, publicKey: registerKeys!.publicKey })));
            if (!tx) return;

            const txHash = await step("Sending transaction", () => walletClient().sendTransaction({ account: account!, chain: CHAIN, ...tx }));
            if (!txHash) return;

            add(`Transaction hash: ${txHash}`);
            const confirmed = await step("Waiting for confirmation", () => waitFor(() => admin.getTransactionStatus(txHash)));
            if (confirmed === null) return;

            await getElection(id);
        });

    const setRegisterKeysBackend = () =>
        withBusy(async () => {
            const id = election!.electionID;
            const signature = await step("Signing register keys message", () =>
                walletClient().signMessage({ account: account!, message: admin.createRegisterKeysMessage(id, registerKeys!.publicKey) }));
            if (!signature) return;

            await step("Setting register keys in backend", async () =>
                checkResult(await admin.setRegisterKeysBackend({ electionID: id, keys: registerKeys!, signature })));
        });

    const providers: (Register & { type: string })[] = [];
    if (registers?.ok) {
        for (const item of registers.value) {
            providers.push({ type: "Register", ...item });
        }
    }
    if (aps?.ok) {
        for (const item of aps.value) {
            providers.push({ type: "AP", ...item });
        }
    }

    async function loadBalances() {
        const loaded: Record<string, bigint> = {};
        try {
            for (const provider of providers) {
                loaded[provider.owner.toLowerCase()] = await publicClient.getBalance({ address: provider.owner });
            }
            } catch (e) {
                add(`✗ Could not load Loading balances: ${e instanceof Error ? e.message : String(e)}`);
            }
        setBalances(loaded);
    }

    const fundPaymaster = () =>
        withBusy(async () => {
            const tx = await step("Creating transaction to fund paymaster", async () =>
                checkResult(await admin.fundPaymaster({ from: account!, amount: parseEther(paymasterAmount) })));
            if (!tx) return;

            const txHash = await step("Sending transaction", () => walletClient().sendTransaction({ account: account!, chain: CHAIN, ...tx }));
            if (!txHash) return;

            add(`Transaction hash: ${txHash}`);
            const confirmed = await step("Waiting for transaction confirmation", () => waitFor(() => admin.getTransactionStatus(txHash)));
            if (confirmed === null) return;

            setPaymaster(await admin.getPaymaster());
        });

    const transferToOwner = (owner: Address) =>
        withBusy(async () => {
            const value = parseEther(transferAmount);
            if (value <= 0n) throw new Error("amount must be positive");

            const txHash = await step(`Sending ${transferAmount} xDAI to ${owner}`, () =>
                walletClient().sendTransaction({ account: account!, chain: CHAIN, to: owner, value }));
            if (!txHash) return;

            add(`Transaction hash: ${txHash}`);
            const confirmed = await step("Waiting for confirmation", () => waitFor(() => admin.getTransactionStatus(txHash)));
            if (confirmed === null) return;

            await loadBalances();
        });

    const now = Date.now() / 1000;

    const canStart = election?.status === "Pending" && election.registerPublicKey !== "0x"
        && now >= election.votingStartTime && now < election.votingEndTime;
    const canEnd = (election?.status === "Pending" || election?.status === "Active")
        && now >= election.votingEndTime;
    
    const canTally = election?.status === "Ended" && electionKeys !== null;
    const canPublishResults = election?.status === "Ended" && electionKeys !== null && tallyResults !== null;
    
    const pinned = cid !== null;
    const prefillLocked = !pinned || !unlocked;
    const canPublish = pinned && electionForm.votingStart && electionForm.votingEnd && electionForm.registerID && electionForm.apID;

    const canSetRegisterKeyOnChain = election?.status === "Pending" && registerKeys !== null
        && election.registerPublicKey.toLowerCase() !== registerKeys.publicKey.toLowerCase();
    const canSetRegisterKeysBackend = election !== null && registerKeys !== null && !!REGISTER_URL;

    const isRegisterOwner = register?.ok && register.value.owner.toLowerCase() === account?.toLowerCase();
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
    const cell: CSSProperties = { border: "1px solid #ddd", padding: "0.25rem 0.5rem" };

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
                    <option value="sponsoring">Sponsor Votes, Register and AP</option>
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
                            <li>election keys: {electionKeyStatus(election.publicKey, electionKeys)}</li>
                        </ul>
                    )}
                    <div style={row}>
                        <label style={{ fontSize: 14 }}>
                            load election keys: <input type="file" accept=".json" disabled={busy} onChange={loadElectionKeysFile} />
                        </label>
                    </div>
                    {coordinatorInfo}
                    {account ? (
                        <>
                            <div style={{ marginBottom: "0.5rem" }}>{accountInfo}</div>
                            <div style={row}>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canStart} onClick={() => changeStatus("start", admin.startElection)}>start Election</button>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canEnd} onClick={() => changeStatus("end", admin.endElection)}>end Election</button>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canTally} onClick={tallyElection}>tally Election</button>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canPublishResults} onClick={publishResults}>publish Results</button>
                            </div>
                        </>
                    ) : (
                        <div style={row}>
                            <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={connectWallet}>connect wallet to manage</button>
                        </div>
                    )}
                    {tallyResults && (
                        <table style={{ fontSize: 14, borderCollapse: "collapse", marginBottom: "1rem" }}>
                            <thead>
                                <tr>
                                    <th style={cell}>question</th>
                                    <th style={cell}>yes</th>
                                    <th style={cell}>no</th>
                                    <th style={cell}>abstain</th>
                                    <th style={cell}>invalid (voter choice)</th>
                                    <th style={cell}>invalid (technical)</th>
                                    <th style={cell}>total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tallyResults.map((result, i) => (
                                    <tr key={i}>
                                        <td style={cell}>{i + 1}</td>
                                        <td style={cell}>{result.yes}</td>
                                        <td style={cell}>{result.no}</td>
                                        <td style={cell}>{result.abstain}</td>
                                        <td style={cell}>{result.invalid}</td>
                                        <td style={cell}>{result.invalidTechnical}</td>
                                        <td style={cell}>{result.yes + result.no + result.abstain + result.invalid + result.invalidTechnical}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            )}

            {role === "register" && (
                <section>
                    <h2 style={{ fontSize: 18 }}>Register keys</h2>
                    <div style={row}>
                        <button style={btn} disabled={busy} onClick={generateRegisterKeys}>generate Register Keys</button>
                        <button style={btn} disabled={busy || !registerKeys} onClick={() => download("register-keys", registerKeys!)}>download</button>
                        <label style={{ fontSize: 14 }}>
                            verifyRegisterKeys: <input type="file" accept=".json" disabled={busy} onChange={verifyRegisterKeysFile} />
                        </label>
                    </div>

                    <h2 style={{ fontSize: 18 }}>Set Register keys for election</h2>
                    <div style={row}>
                        {field("election ID", manageID, setManageID, "number")}
                        <button style={btn} disabled={busy || !manageID} onClick={loadElection}>Get Election</button>
                    </div>
                    {election && (
                        <ul style={{ fontSize: 14, margin: "0 0 1rem" }}>
                            <li>election {election.electionID}: <b>{election.status}</b></li>
                            <li>
                                register ID: {election.registerID}{register?.ok && ` (${register.value.name})`} · register key on-chain:{" "}
                                {registerKeyStatus(election.registerPublicKey, registerKeys)}
                            </li>
                        </ul>
                    )}
                    <div style={{ borderTop: "1px solid #ddd", paddingTop: "1rem", marginBottom: "0.5rem", fontSize: 13 }}>
                        Register owner:
                        {!register && " —"}
                        {register && !register.ok && ` ${register.code}: ${register.error}`}
                        {register?.ok && ` ${register.value.owner}`}
                    </div>
                    {account ? (
                        <>
                            <div style={{ marginBottom: "0.5rem", fontSize: 13 }}>
                                {account} {register?.ok && (isRegisterOwner ? "✓ register owner" : "✗ not register owner")}
                            </div>
                            <div style={row}>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canSetRegisterKeyOnChain} onClick={setRegisterPublicKeyOnChain}>set Register Key on Chain</button>
                                <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !canSetRegisterKeysBackend} onClick={setRegisterKeysBackend}>set Register Keys Backend</button>
                            </div>
                        </>
                    ) : (
                        <div style={row}>
                            <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={connectWallet}>connect wallet</button>
                        </div>
                    )}
                </section>
            )}

            {role === "sponsoring" && (
                <section>
                    <div style={row}>
                        {account ? (
                            <span style={{ fontSize: 13 }}>{account}</span>
                        ) : (
                            <button style={{ ...btn, fontWeight: "bold" }} disabled={busy} onClick={connectWallet}>connect wallet</button>
                        )}
                    </div>

                    <h2 style={{ fontSize: 18 }}>Paymaster</h2>
                    <p style={{ fontSize: 13, color: "#555" }}>Sponsor transaction costs for voters</p>
                    {!paymaster && <p style={{ fontSize: 14 }}>loading</p>}
                    {paymaster && !paymaster.ok && <p style={{ fontSize: 14 }}>{paymaster.code}: {paymaster.error}</p>}
                    {paymaster?.ok && (
                        <ul style={{ fontSize: 14, margin: "0 0 1rem" }}>
                            <li>paymaster: {PAYMASTER_ADDRESS}</li>
                            <li>deposit: <b>{formatAmount(paymaster.value.deposit)}</b></li>
                            <li>max sponsored votes per voter and election: {paymaster.value.maxOpsPerElection}</li>
                            <li>max cost per vote: {formatAmount(paymaster.value.maxCostCap)}</li>
                            <li>max fee per gas: {formatGwei(paymaster.value.maxFeePerGasCap)} gwei</li>
                        </ul>
                    )}
                    <div style={row}>
                        {field("amount (xDAI)", paymasterAmount, setPaymasterAmount)}
                        <button style={{ ...btn, fontWeight: "bold" }} disabled={busy || !account || !paymasterAmount} onClick={fundPaymaster}>sponsor</button>
                    </div>

                    <h2 style={{ fontSize: 18 }}>Register and AP</h2>
                    <p style={{ fontSize: 13, color: "#555" }}>Sponsor transaction costs for on-chain registrations and authorizations</p>
                    {registers && !registers.ok && <p style={{ fontSize: 14 }}>registers: {registers.code}: {registers.error}</p>}
                    {aps && !aps.ok && <p style={{ fontSize: 14 }}>APs: {aps.code}: {aps.error}</p>}
                    <div style={row}>
                        {field("amount (xDAI)", transferAmount, setTransferAmount)}
                    </div>
                    <table style={{ fontSize: 13, borderCollapse: "collapse", marginBottom: "1rem" }}>
                        <thead>
                            <tr>
                                <th style={cell}>type</th>
                                <th style={cell}>name</th>
                                <th style={cell}>owner</th>
                                <th style={cell}>balance</th>
                                <th style={cell}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {providers.map((provider) => (
                                <tr key={`${provider.type}-${provider.id}`}>
                                    <td style={cell}>{provider.type}</td>
                                    <td style={cell}>{provider.name} (ID {provider.id})</td>
                                    <td style={cell}>{provider.owner}</td>
                                    <td style={cell}>{formatAmount(balances[provider.owner.toLowerCase()])}</td>
                                    <td style={cell}>
                                        <button style={btn} disabled={busy || !account || !transferAmount} onClick={() => transferToOwner(provider.owner)}>sponsor</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
