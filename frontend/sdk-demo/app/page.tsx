"use client";

import { useState } from "react";
import { createClient } from "votingsystem/client";
import type { VotingClient } from "votingsystem/client";
import { VoteOption } from "votingsystem";
import type { ElectionCredentials, MasterKey } from "votingsystem";
import { gnosis } from "viem/chains";
import { QRCodeSVG } from "qrcode.react";


const env = {
    registerUrl: process.env.NEXT_PUBLIC_REGISTER_URL,
    svsUrl: process.env.NEXT_PUBLIC_SVS_URL,
    subgraphUrl: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
    opnvote: process.env.NEXT_PUBLIC_OPNVOTE_ADDRESS,
    paymaster: process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS,
    delegation: process.env.NEXT_PUBLIC_DELEGATION_ADDRESS,
    entryPoint: process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS,
};

const SAMPLE_VOTES = [{ value: VoteOption.Yes }, { value: VoteOption.No }, { value: VoteOption.No }];
const RECAST_VOTES = [{ value: VoteOption.No }, { value: VoteOption.No }, { value: VoteOption.Yes }];


async function fetchElectionKeys(subgraphUrl: string, electionID: number) {
    const res = await fetch(subgraphUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ election(id: "${electionID}") { publicKey registerPublicKey } }` }),
    });
    const json = await res.json();
    const election = json?.data?.election;
    if (!election) throw new Error(`election ${electionID} not found in subgraph`);
    return election as { publicKey: string; registerPublicKey: string };
}

export default function Home() {
    const [electionId, setElectionId] = useState("");
    const [voterJwt, setVoterJwt] = useState("");
    const [client, setClient] = useState<VotingClient | null>(null);
    const [masterKey, setMasterKey] = useState<MasterKey | null>(null);
    const [credentials, setCredentials] = useState<ElectionCredentials | null>(null);
    const [qr, setQr] = useState("");
    const [log, setLog] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    const add = (line: string) => setLog((prev) => [...prev, line]);

    async function withBusy(fn: () => void | Promise<void>) {
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            add("threw: " + String(e));
        } finally {
            setBusy(false);
        }
    }

    const createClientOp = () =>
        withBusy(async () => {
            const id = Number(electionId);
            if (!id) return add("✗ enter electionID");
            const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
            if (missing.length) return add("✗ missing env: " + missing.join(", "));

            add(`createClient(electionID=${id})…`);
            const { publicKey, registerPublicKey } = await fetchElectionKeys(env.subgraphUrl!, id);
            const c = createClient(
                {
                    endpoints: { registerUrl: env.registerUrl!, svsUrl: env.svsUrl!, subgraphUrl: env.subgraphUrl! },
                    contracts: {
                        opnvote: env.opnvote as `0x${string}`,
                        paymaster: env.paymaster as `0x${string}`,
                        delegation: env.delegation as `0x${string}`,
                        entryPoint: env.entryPoint as `0x${string}`,
                    },
                    rpcUrl: env.rpcUrl!,
                    chain: gnosis,
                },
                { electionID: id, publicKey, registerPublicKey },
            );
            setClient(c);
            setCredentials(null);
            add("  ✓ client ready");
        });

    const generateMasterKeyOp = () =>
        withBusy(() => {
            const mk = client!.generateMasterKey();
            setMasterKey(mk);
            add("generateMasterKey → " + mk.hexString.slice(0, 18) + "…");
        });

    const registerVoterOp = () =>
        withBusy(async () => {
            add("registerVoter…");
            const r = await client!.registerVoter({ voterJwt, masterKey: masterKey ?? undefined });
            if (!r.ok) return add("  ✗ " + r.error);
            setCredentials(r.value);
            add("  ✓ credentials ready");
        });

    const exportOp = () =>
        withBusy(() => {
            const s = client!.exportCredentials(credentials!);
            setQr(s);
            add(`exportCredentials → ${s.length} chars (${s.slice(0, 24)}…)`);
        });

    const importOp = () =>
        withBusy(() => {
            setCredentials(client!.importCredentials(qr));
            add("QR imported ✓");
        });

    const voteOp = () =>
        withBusy(async () => {
            add("vote([Yes, No, No])…");
            const r = await client!.vote({ credentials: credentials!, votes: SAMPLE_VOTES });
            add(r.ok ? "  ✓ tx " + r.value.txHash : "  ✗ " + r.error);
        });

    const recastOp = () =>
        withBusy(async () => {
            add("recastVote([No, No, Yes])…");
            const r = await client!.recastVote({ credentials: credentials!, votes: RECAST_VOTES });
            add(r.ok ? "  ✓ tx " + r.value.txHash : "  ✗ " + r.error);
        });

    const checkOp = () =>
        withBusy(async () => {
            add("checkVote…");
            const r = await client!.checkVote({ credentials: credentials! });
            add(r.ok ? `  ✓ indexed=${r.value.indexed} tx=${r.value.txHash ?? "-"}` : "  ✗ " + r.error);
        });

    const hasClient = !!client;
    const hasCreds = !!credentials;
    const btn = { padding: "0.4rem 0.8rem", fontSize: 14 };

    return (
        <main style={{ fontFamily: "sans-serif", maxWidth: 760, margin: "2rem auto", padding: "0 1rem" }}>
            <h1>opnvote SDK demo</h1>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <input
                    value={electionId}
                    onChange={(e) => setElectionId(e.target.value)}
                    placeholder="electionID"
                    style={{ width: 120, padding: "0.4rem", fontSize: 14 }}
                />
                <input
                    value={voterJwt}
                    onChange={(e) => setVoterJwt(e.target.value)}
                    placeholder="voter JWT"
                    style={{ flex: 1, minWidth: 240, padding: "0.4rem", fontSize: 14 }}
                />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <button style={btn} disabled={busy || !electionId} onClick={createClientOp}>createClient</button>
                <button style={btn} disabled={busy || !hasClient} onClick={generateMasterKeyOp}>generateMasterKey</button>
                <button style={btn} disabled={busy || !hasClient || !voterJwt} onClick={registerVoterOp}>registerVoter</button>
                <button style={btn} disabled={busy || !hasCreds} onClick={exportOp}>exportCredentials</button>
                <button style={btn} disabled={busy || !qr} onClick={importOp}>importCredentials</button>
                <button style={btn} disabled={busy || !hasCreds} onClick={voteOp}>vote</button>
                <button style={btn} disabled={busy || !hasCreds} onClick={recastOp}>recastVote</button>
                <button style={btn} disabled={busy || !hasCreds} onClick={checkOp}>checkVote</button>
            </div>

            <div style={{ fontSize: 13, color: "#555", marginBottom: "0.5rem" }}>
                client: {hasClient ? "✓" : "—"} · masterKey: {masterKey ? "✓" : "—"} · credentials: {hasCreds ? "✓" : "—"}
            </div>

            {qr && (
                <div style={{ marginBottom: "1rem" }}>
                    <QRCodeSVG value={qr} size={180} />
                </div>
            )}

            <pre style={{ background: "#f4f4f4", padding: "1rem", whiteSpace: "pre-wrap", borderRadius: 6, minHeight: 120 }}>
                {log.length ? log.join("\n") : "Enter electionID + JWT"}
            </pre>
        </main>
    );
}
