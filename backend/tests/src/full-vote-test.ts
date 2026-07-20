import 'dotenv/config'
import { createSign } from 'node:crypto'
import { hashMessage, createPublicClient, http, custom, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { gnosis } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { to7702SimpleSmartAccount } from 'permissionless/accounts'
import {
  generateMasterKey,
  deriveElectionWallet,
  deriveElectionUnblindedToken,
  generateBlindingR,
  blindToken,
  unblindSignature,
  verifyUnblindedSignature,
  createVoterCredentials,
  encryptVotes,
  createVotingTransaction,
  createVoteRecastTransaction,
  createVoteCalldata,
  EncryptionType,
  VoteOption,
  evmG2ToNoble,
} from 'votingsystem'
import type { BlsParams, BlsSignature, EncryptionKey, Vote } from 'votingsystem'

const CHAIN = gnosis
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as const

const OPNVOTE_ABI = [
  {
    type: 'function',
    name: 'vote',
    inputs: [
      { name: 'electionId', type: 'uint256' },
      { name: 'voteEncrypted', type: 'bytes' },
      { name: 'voteEncryptedUser', type: 'bytes' },
      { name: 'unblindedSignature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

function log(label: string, value?: unknown): void {
  const ts = new Date().toISOString()
  if (value !== undefined) {
    console.log(`[${ts}] ${label}:`, typeof value === 'object' ? JSON.stringify(value) : value)
  } else {
    console.log(`[${ts}] ${label}`)
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function createJwt(payload: object, rsaPrivKeyPem: string): string {
  const b64url = (s: string) => Buffer.from(s).toString('base64url')
  const header = { alg: 'RS256', typ: 'JWT' }
  const sigInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sign = createSign('RSA-SHA256')
  sign.update(sigInput)
  return `${sigInput}.${sign.sign(rsaPrivKeyPem, 'base64url')}`
}

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as any
  if (!res.ok) throw new Error(`POST ${url} [${res.status}]: ${JSON.stringify(json)}`)
  if (json.error) throw new Error(`POST ${url} API error: ${JSON.stringify(json.error)}`)
  return json.data as T
}

async function querySubgraph<T>(subgraphUrl: string, query: string): Promise<T> {
  const res = await fetch(subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const json = (await res.json()) as any
  if (!res.ok || json.errors) {
    throw new Error(`Subgraph error: ${JSON.stringify(json.errors ?? json)}`)
  }
  return json.data as T
}

function createSvsForwardTransport(svsUrl: string) {
  return custom({
    async request({ method, params }: { method: string; params: unknown[] }) {
      const res = await fetch(`${svsUrl}/api/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      })
      const json = (await res.json()) as any
      if (!res.ok || json.error)
        throw new Error(`SVS forward [${res.status}]: ${json.error ?? JSON.stringify(json)}`)
      const bundlerResponse = json.data
      if (bundlerResponse.error)
        throw new Error(`Bundler error: ${JSON.stringify(bundlerResponse.error)}`)
      return bundlerResponse.result
    },
  })
}

async function run(includeRecast = false): Promise<string> {
  const electionIdEnv = process.env.ELECTION_ID
  if (!electionIdEnv) throw new Error('ELECTION_ID required in .env')
  const ELECTION_ID = Number(electionIdEnv)

  const apUrl = process.env.AP_URL
  if (!apUrl) throw new Error('AP_URL required in .env')
  const svsUrl = process.env.SVS_URL
  if (!svsUrl) throw new Error('SVS_URL required in .env')
  const registerUrl = process.env.REGISTER_URL
  if (!registerUrl) throw new Error('REGISTER_URL required in .env')
  const subgraphUrl = process.env.SUBGRAPH_URL
  if (!subgraphUrl) throw new Error('SUBGRAPH_URL required in .env')
  const opnVoteAddress = process.env.OPNVOTE_ADDRESS
  if (!opnVoteAddress) throw new Error('OPNVOTE_ADDRESS required in .env')
  const paymasterAddress = process.env.PAYMASTER_ADDRESS
  if (!paymasterAddress) throw new Error('PAYMASTER_ADDRESS required in .env')

  const rpcUrl = process.env.RPC_PROVIDER
  if (!rpcUrl) throw new Error('RPC_PROVIDER required in .env')

  const apPrivKey = process.env.AP_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!apPrivKey) throw new Error('AP_PRIVATE_KEY required in .env (PEM, use \\n for newlines)')

  const userId = Math.floor(Date.now() / 1000) % 1_000_000_000

  log('Fetching election keys from subgraph...')
  const { election } = await querySubgraph<{
    election: { publicKey: string; registerPublicKey: string } | null
  }>(
    subgraphUrl,
    `{ election(id: "${ELECTION_ID}") { publicKey registerPublicKey } }`,
  )
  if (!election) throw new Error(`Election ${ELECTION_ID} not found in subgraph`)
  if (!election.registerPublicKey)
    throw new Error(`Register public key not set on-chain for election ${ELECTION_ID}`)
  if (!election.publicKey)
    throw new Error(`Coordinator public key not set on-chain for election ${ELECTION_ID}`)

  const blsParams: BlsParams = { pk: evmG2ToNoble(election.registerPublicKey) }

  const coordinatorKey: EncryptionKey = {
    hexString: election.publicKey,
    encryptionType: EncryptionType.RSA,
  }

  log('--- Step 1: AP authorize ---')
  const apJwt = createJwt({ electionId: ELECTION_ID }, apPrivKey)
  const { successfulIds, failedIds } = await postJson<{
    successfulIds: number[]
    failedIds: { voterId: number; error: string }[]
    totalProcessed: number
  }>(
    `${apUrl}/api/authorize`,
    { electionId: ELECTION_ID, voterIds: [userId.toString()] },
    { Authorization: `Bearer ${apJwt}` },
  )

  if (!successfulIds.includes(userId)) {
    const reason = failedIds.find(f => f.voterId === userId)?.error ?? 'unknown'
    if (!reason.toLowerCase().includes('already')) {
      throw new Error(`AP authorize failed for voter ${userId}: ${reason}`)
    }
    log('Voter already authorized (OK)', userId)
  } else {
    log('Voter authorized ✓', userId)
  }

  log('--- Step 2: Register ---')
  const voterJwt = createJwt({ voterId: userId, electionId: ELECTION_ID }, apPrivKey)

  const masterKey = generateMasterKey()
  const voterWallet = deriveElectionWallet(masterKey, ELECTION_ID)
  const unblindedElectionToken = deriveElectionUnblindedToken(ELECTION_ID, voterWallet.address)
  const electionR = generateBlindingR()
  const blindedToken = blindToken(unblindedElectionToken, electionR)

  const { blindedSignature: blindedSigHex } = await postJson<{ blindedSignature: string }>(
    `${registerUrl}/api/sign`,
    { token: blindedToken },
    { Authorization: `Bearer ${voterJwt}` },
  )

  const blindedSig: BlsSignature = { hexString: blindedSigHex, isBlinded: true }
  const unblindedSig = unblindSignature(blindedSig, electionR)
  const isValidBlsSig = verifyUnblindedSignature(unblindedSig, unblindedElectionToken, blsParams)
  if (!isValidBlsSig) throw new Error('Unblinded signature failed BLS verification')

  log('--- Step 3: Voter credentials ---')
  const voterCredentials = createVoterCredentials(unblindedSig, masterKey, ELECTION_ID)
  const voterAccount = privateKeyToAccount(voterCredentials.voterWallet.privateKey as Hex)
  log('Voter address', voterAccount.address)

  log('--- Step 4: sponsor ---')
  const votes: Vote[] = [
    { value: VoteOption.Yes },
    { value: VoteOption.No },
    { value: VoteOption.No },
  ]
  const encryptedVotesRSA = await encryptVotes(votes, coordinatorKey, EncryptionType.RSA)
  const encryptedVotesAES = await encryptVotes(
    votes,
    voterCredentials.encryptionKey,
    EncryptionType.AES,
  )
  const votingTransaction = createVotingTransaction(
    voterCredentials,
    encryptedVotesRSA,
    encryptedVotesAES,
  )

  const sponsorMsgHash = hashMessage(JSON.stringify(votingTransaction))
  const sponsorSig = await voterAccount.signMessage({ message: sponsorMsgHash })

  const { paymasterData, userOpParams } = await postJson<{
    paymasterData: Hex
    userOpParams: {
      nonce: string
      callGasLimit: string
      verificationGasLimit: string
      preVerificationGas: string
      paymasterVerificationGasLimit: string
      paymasterPostOpGasLimit: string
      maxFeePerGas: string
      maxPriorityFeePerGas: string
    }
  }>(`${svsUrl}/api/userOp/sponsor`, {
    votingTransaction,
    voterSignature: { hexString: sponsorSig },
  })

  log('--- Step 5: ERC-4337 submit ---')
  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl),
  })
  const smartAccount = await to7702SimpleSmartAccount({
    client: publicClient,
    owner: voterAccount,
    accountLogicAddress: DELEGATION_ADDRESS,
    entryPoint: { address: ENTRY_POINT, version: '0.8' },
  })

  const voteCalldata = createVoteCalldata(votingTransaction, OPNVOTE_ABI) as Hex

  const smartAccountClient = createSmartAccountClient({
    client: publicClient,
    chain: CHAIN,
    account: smartAccount,
    paymaster: {
      async getPaymasterStubData() {
        return {
          paymaster: paymasterAddress as Hex,
          paymasterData,
          isFinal: true as const,
          callGasLimit: BigInt(userOpParams.callGasLimit),
          verificationGasLimit: BigInt(userOpParams.verificationGasLimit),
          preVerificationGas: BigInt(userOpParams.preVerificationGas),
          paymasterVerificationGasLimit: BigInt(userOpParams.paymasterVerificationGasLimit),
          paymasterPostOpGasLimit: BigInt(userOpParams.paymasterPostOpGasLimit),
        }
      },
      async getPaymasterData() {
        throw new Error('getPaymasterData should not be called when isFinal: true')
      },
    },
    bundlerTransport: createSvsForwardTransport(svsUrl),
    userOperation: {
      estimateFeesPerGas: async () => ({
        maxFeePerGas: BigInt(userOpParams.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(userOpParams.maxPriorityFeePerGas),
      }),
    },
  })

  const isDeployed = await smartAccount.isDeployed()
  const sendParams = {
    calls: [{ to: opnVoteAddress as Hex, value: 0n, data: voteCalldata }] as const,
    nonce: BigInt(userOpParams.nonce),
  }

  let userOpHash: Hex
  if (!isDeployed) {
    const eoaNonce = await publicClient.getTransactionCount({ address: voterAccount.address })
    const authorization = await voterAccount.signAuthorization({
      address: DELEGATION_ADDRESS,
      chainId: CHAIN.id,
      nonce: eoaNonce,
    })
    userOpHash = await smartAccountClient.sendUserOperation({ ...sendParams, authorization })
  } else {
    userOpHash = await smartAccountClient.sendUserOperation(sendParams)
  }

  log('UserOp hash', userOpHash)
  const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash })
  const txHash = receipt.receipt.transactionHash
  log('Tx hash', txHash)

  if (!receipt.success) {
    throw new Error(`UserOp reverted: ${txHash}`)
  }

  log('--- Step 7: Verify on subgraph ---')
  const voterAddress = voterAccount.address.toLowerCase()
  for (let attempt = 1; attempt <= 10; attempt++) {
    const { voteCasts } = await querySubgraph<{ voteCasts: { transactionHash: string }[] }>(
      subgraphUrl,
      `{ voteCasts(where: { electionId: "${ELECTION_ID}", voter: "${voterAddress}" }, first: 1) { transactionHash } }`,
    )
    if (voteCasts.length > 0) {
      log('Vote indexed in subgraph ✓', voteCasts[0].transactionHash)
      break
    }
    if (attempt === 10) {
      log('Vote not yet indexed after 10 attempts (subgraph may lag — tx succeeded)')
    } else {
      log(`Waiting for subgraph... (attempt ${attempt}/10)`)
      await sleep(6000)
    }
  }

  log('=== DONE ===')
  log('Explorer', `https://gnosisscan.io/tx/${txHash}`)
  log('Gas cost (xDAI)', (Number(receipt.actualGasCost) / 1e18).toFixed(8))

  if (!includeRecast) return txHash

  log('=== Vote recast ===')

  log('--- Step 4 (recast) ---')
  const recastVotes: Vote[] = [
    { value: VoteOption.No },
    { value: VoteOption.No },
    { value: VoteOption.Yes },
  ]
  const recastEncryptedVotesRSA = await encryptVotes(
    recastVotes,
    coordinatorKey,
    EncryptionType.RSA,
  )
  const recastEncryptedVotesAES = await encryptVotes(
    recastVotes,
    voterCredentials.encryptionKey,
    EncryptionType.AES,
  )
  const recastVotingTransaction = createVoteRecastTransaction(
    voterCredentials,
    recastEncryptedVotesRSA,
    recastEncryptedVotesAES,
  )

  log('--- Step 5 (recast): SVS sponsor ---')
  const recastSponsorMsgHash = hashMessage(JSON.stringify(recastVotingTransaction))
  const recastSponsorSig = await voterAccount.signMessage({ message: recastSponsorMsgHash })

  const { paymasterData: recastPaymasterData, userOpParams: recastUserOpParams } = await postJson<{
    paymasterData: Hex
    userOpParams: {
      nonce: string
      callGasLimit: string
      verificationGasLimit: string
      preVerificationGas: string
      paymasterVerificationGasLimit: string
      paymasterPostOpGasLimit: string
      maxFeePerGas: string
      maxPriorityFeePerGas: string
    }
  }>(`${svsUrl}/api/userOp/sponsor`, {
    votingTransaction: recastVotingTransaction,
    voterSignature: { hexString: recastSponsorSig },
  })

  log('--- Step 6 (recast): ERC-4337 submit ---')
  const recastVoteCalldata = createVoteCalldata(recastVotingTransaction, OPNVOTE_ABI) as Hex

  const recastSmartAccountClient = createSmartAccountClient({
    client: publicClient,
    chain: CHAIN,
    account: smartAccount,
    paymaster: {
      async getPaymasterStubData() {
        return {
          paymaster: paymasterAddress as Hex,
          paymasterData: recastPaymasterData,
          isFinal: true as const,
          callGasLimit: BigInt(recastUserOpParams.callGasLimit),
          verificationGasLimit: BigInt(recastUserOpParams.verificationGasLimit),
          preVerificationGas: BigInt(recastUserOpParams.preVerificationGas),
          paymasterVerificationGasLimit: BigInt(recastUserOpParams.paymasterVerificationGasLimit),
          paymasterPostOpGasLimit: BigInt(recastUserOpParams.paymasterPostOpGasLimit),
        }
      },
      async getPaymasterData() {
        throw new Error('getPaymasterData should not be called when isFinal: true')
      },
    },
    bundlerTransport: createSvsForwardTransport(svsUrl),
    userOperation: {
      estimateFeesPerGas: async () => ({
        maxFeePerGas: BigInt(recastUserOpParams.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(recastUserOpParams.maxPriorityFeePerGas),
      }),
    },
  })

  const recastUserOpHash = await recastSmartAccountClient.sendUserOperation({
    calls: [{ to: opnVoteAddress as Hex, value: 0n, data: recastVoteCalldata }] as const,
    nonce: BigInt(recastUserOpParams.nonce),
  })

  log('UserOp hash', recastUserOpHash)
  const recastReceipt = await recastSmartAccountClient.waitForUserOperationReceipt({
    hash: recastUserOpHash,
  })
  const recastTxHash = recastReceipt.receipt.transactionHash
  log('Tx hash', recastTxHash)

  if (!recastReceipt.success) {
    throw new Error(`UserOp reverted: ${recastTxHash}`)
  }

  log('--- Step 7 (recast): Verify on subgraph ---')
  for (let attempt = 1; attempt <= 10; attempt++) {
    const { voteUpdateds } = await querySubgraph<{ voteUpdateds: { transactionHash: string }[] }>(
      subgraphUrl,
      `{ voteUpdateds(where: { electionId: "${ELECTION_ID}", voter: "${voterAddress}" }, orderBy: blockNumber, orderDirection: desc, first: 1) { transactionHash } }`,
    )
    if (voteUpdateds.length > 0 && voteUpdateds[0].transactionHash === recastTxHash) {
      log('Recast vote indexed in subgraph ✓', recastTxHash)
      break
    }
    if (attempt === 10) {
      log('Recast vote not yet indexed after 10 attempts (subgraph may lag — tx succeeded)')
    } else {
      log(`Waiting for subgraph... (attempt ${attempt}/10)`)
      await sleep(6000)
    }
  }

  log('=== DONE ===')
  log('Explorer', `https://gnosisscan.io/tx/${recastTxHash}`)
  log('Gas cost (xDAI)', (Number(recastReceipt.actualGasCost) / 1e18).toFixed(8))
  return recastTxHash
}

export async function runVoteTest(
  options: { includeRecast?: boolean } = {},
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    const txHash = await run(options.includeRecast ?? false)
    return { success: true, txHash }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

if (require.main === module) {
  const includeRecast = process.env.VOTE_RECAST === 'true'
  runVoteTest({ includeRecast }).then(result => {
    if (!result.success) {
      console.error('Test failed:', result.error)
      process.exit(1)
    }
  })
}
