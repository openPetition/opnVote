# Election Lifecycle

The lifecycle below reflects the current MVP implementation where tallying happens off-chain and results are published on-chain.

<div class="mermaid-container">
<div class="mermaid">
sequenceDiagram
    autonumber
    participant EC as Election Coordinator
    participant AP as Authorization Provider
    participant Reg as Register Service
    participant V as Voter (Frontend + SDK)
    participant SVS as Signature Validation Server
    participant Gelato as Gelato Relay
    participant Contract as OpnVote.sol
    participant IPFS as IPFS Pinning
    participant Subgraph as Subgraph

    EC->>IPFS: Pin election description
    EC->>Contract: Create election (params, CID)
    AP->>AP: Determine eligible voters & store pending authorizations
    AP->>Contract: Authorize voters (batch)

    V->>Reg: POST /api/sign (blinded token)
    Reg-->>V: Blind signature
    V->>V: Unblind signature to obtain credential
    V->>V: Construct & encrypt ballot within voting transaction

    V->>SVS: POST /api/votingTransaction/sign
    SVS->>SVS: Validate payloads + cache record
    SVS->>Gelato: Sponsored meta-transaction (EIP-2771)
    Gelato->>Contract: Forward meta-transaction
    Contract->>Contract: Emit encrypted ballot / recast
    Contract->>Subgraph: Emit VoteCast / VoteUpdated

    EC->>Contract: Publish results & decryption key
    Contract->>Subgraph: Emit ElectionResultsPublished

    Subgraph-->>V: Serve ballots & results for verification

</div>
</div>

## 1. Environment Setup

The system admin deploys `OpnVote.sol` on Gnosis Chain and configures the trusted forwarder and available service providers (Register, AP, SVS addresses). The election coordinator then creates an election by selecting service providers, pinning the election description to IPFS, and setting start/end times. The description CID is recorded on-chain. (In the current MVP, system admin and election coordinator are the same entity.)

## 2. Eligibility & Authorization

The Authorization Provider determines eligible voters (e.g., through eID verification), stores them locally as pending authorizations, and submits batched `authorizeVoters` transactions to the contract. These on-chain events create a public record of eligibility.

## 3. Registration (Blind Signature Issuance)

Voters generate a blinded token via the frontend or SDK and submit it to the Register service. The service validates the request, checks for duplicate registrations, and returns a blind signature. These credentials are persisted locally and published on-chain for auditing.

## 4. Credential Unblinding

Voters unblind the signature locally using the SDK to obtain their voting credential `(token, signature)`. Credentials can be exported as a QR code for offline storage.

## 5. Ballot Construction

Voters encrypt their choices with the election's public key (RSA). They also encrypt with their own AES key to allow decryption during the election period (an MVP feature that may be removed in future iterations). The SDK creates a `VotingTransaction` containing the credential, encrypted ballot, and voter address, which the voter signs with their wallet key.

## 6. SVS Signing & Relay Submission

The signed ballot is submitted to the SVS, which validates the payload and the register signature, then adds its own EIP-191 signature. The SVS then forwards the transaction to Gelato Relay as a sponsored EIP-2771 meta-transaction, covering gas costs for the voter.

## 7. On-Chain Casting & Recasting

`OpnVote.sol` verifies the SVS signature and voter authorization, then emits the encrypted ballot via `VoteCast` or `VoteUpdated` events. These events are indexed by subgraphs for auditors.

## 8. Tallying & Publication

After the voting window closes, the coordinator decrypts all ballots offline using the `votingSystem` library. The aggregated tallies and decryption private key are published on-chain, emitting an `ElectionResultsPublished` event.

## 9. Public Verification

Auditors retrieve encrypted ballots, the decryption key, and election descriptions from the blockchain and IPFS to independently reproduce the tally.
