import 'dotenv/config'
import { createSign } from 'node:crypto'
import { createPublicClient, formatEther, http, parseEther, type Address } from 'viem'
import { gnosis } from 'viem/chains'
import { createClient } from 'votingsystem/client'
import { VoteOption } from 'votingsystem'
import type { ElectionCredentials, Vote } from 'votingsystem'

const CHAIN = gnosis
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as const
const DEFAULT_MIN_PAYMASTER_DEPOSIT = '0.05'
const INDEXING_ATTEMPTS = 10
const INDEXING_INTERVAL_MS = 6000

const PAYMASTER_ABI = [
  {
    type: 'function',
    name: 'getDeposit',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

const VOTES: Vote[] = [
  { value: VoteOption.Yes },
  { value: VoteOption.No },
  { value: VoteOption.Abstain },
  { value: VoteOption.Yes },
  { value: VoteOption.No },
]

const RECAST_VOTES: Vote[] = [
  { value: VoteOption.No },
  { value: VoteOption.Yes },
  { value: VoteOption.Yes },
  { value: VoteOption.Abstain },
  { value: VoteOption.Yes },
]

function log(label: string, value?: unknown): void {
  const ts = new Date().toISOString()
  if (value !== undefined) {
    console.log(`[${ts}] ${label}:`, typeof value === 'object' ? JSON.stringify(value) : value)
  } else {
    console.log(`[${ts}] ${label}`)
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} required in .env`)
  return value
}

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

async function waitForIndexing(
  client: ReturnType<typeof createClient>,
  credentials: ElectionCredentials,
  txHash: string,
  label: string,
): Promise<void> {
  for (let attempt = 1; attempt <= INDEXING_ATTEMPTS; attempt++) {
    const status = await client.checkVote({ credentials, txHash })
    if (status.ok && status.value.indexed) {
      log(`${label} indexed in subgraph ✓`, txHash)
      return
    }
    if (attempt === INDEXING_ATTEMPTS) {
      log(
        `${label} not indexed after ${INDEXING_ATTEMPTS} attempts.`,
      )
      return
    }
    log(`Waiting for subgraph... (attempt ${attempt}/${INDEXING_ATTEMPTS})`)
    await sleep(INDEXING_INTERVAL_MS)
  }
}

async function checkPaymasterDeposit(rpcUrl: string, paymaster: Address): Promise<void> {
  const minDeposit = parseEther(
    process.env.MIN_PAYMASTER_DEPOSIT ?? DEFAULT_MIN_PAYMASTER_DEPOSIT,
  )
  const publicClient = createPublicClient({ chain: CHAIN, transport: http(rpcUrl) })
  const deposit = await publicClient.readContract({
    address: paymaster,
    abi: PAYMASTER_ABI,
    functionName: 'getDeposit',
  })

  log('Paymaster deposit (xDAI)', formatEther(deposit))
  if (deposit < minDeposit) {
    throw new Error(
      `Paymaster ${paymaster} deposit ${formatEther(deposit)} is below ` +
        `minimum of ${formatEther(minDeposit)}`,
    )
  }
}

async function run(includeRecast = false): Promise<string> {
  const ELECTION_ID = Number(requireEnv('ELECTION_ID'))
  const apUrl = requireEnv('AP_URL')
  const registerUrl = requireEnv('REGISTER_URL')
  const bundlerUrl = requireEnv('BUNDLER_URL')
  const subgraphUrl = requireEnv('SUBGRAPH_URL')
  const opnvoteAddress = requireEnv('OPNVOTE_ADDRESS')
  const paymasterAddress = requireEnv('PAYMASTER_ADDRESS')
  const rpcUrl = requireEnv('RPC_PROVIDER')
  const apPrivKey = requireEnv('AP_PRIVATE_KEY').replace(/\\n/g, '\n')
  const svsUrl = process.env.SVS_URL

  const userId = Math.floor(Date.now() / 1000) % 1_000_000_000

  log('Fetching election keys from subgraph...')
  const { election } = await querySubgraph<{
    election: { publicKey: string; registerPublicKey: string } | null
  }>(subgraphUrl, `{ election(id: "${ELECTION_ID}") { publicKey registerPublicKey } }`)
  if (!election) throw new Error(`Election ${ELECTION_ID} not found in subgraph`)
  if (!election.registerPublicKey)
    throw new Error(`Register public key not set on-chain for election ${ELECTION_ID}`)
  if (!election.publicKey)
    throw new Error(`Coordinator public key not set on-chain for election ${ELECTION_ID}`)

  const client = createClient(
    {
      endpoints: { registerUrl, bundlerUrl, subgraphUrl, ...(svsUrl ? { svsUrl } : {}) },
      contracts: {
        opnvote: opnvoteAddress as Address,
        paymaster: paymasterAddress as Address,
        delegation: DELEGATION_ADDRESS,
        entryPoint: ENTRY_POINT,
      },
      rpcUrl,
      chain: CHAIN,
    },
    {
      electionID: ELECTION_ID,
      publicKey: election.publicKey,
      registerPublicKey: election.registerPublicKey,
    },
  )
  log('--- Step 1: Paymaster check ---')
  await checkPaymasterDeposit(rpcUrl, paymasterAddress as Address)

  log('--- Step 2: AP authorize ---')
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

  log('--- Step 3: Register ---')
  const voterJwt = createJwt({ voterId: userId, electionId: ELECTION_ID }, apPrivKey)
  const masterKey = client.generateMasterKey()

  const registration = await client.registerVoter({ voterJwt, masterKey })
  if (!registration.ok) throw new Error(`Registration failed: ${registration.error}`)
  const credentials = registration.value
  log('Voter address', credentials.voterWallet.address)

  const retryRegistration = await client.registerVoter({ voterJwt, masterKey })
  if (!retryRegistration.ok) throw new Error(`Failed to obtain same blinded signature: ${retryRegistration.error}`)
  if (
    retryRegistration.value.unblindedSignature.hexString !== credentials.unblindedSignature.hexString
  ) {
    throw new Error('Second registration returned a different unblinded signature')
  }
  if (retryRegistration.value.voterWallet.address !== credentials.voterWallet.address) {
    throw new Error('Second registration returned a different voter wallet address')
  }
  log('Recovered registration with same master key ✓')

  const differentKeyRegistration = await client.registerVoter({
    voterJwt,
    masterKey: client.generateMasterKey(),
  })
  if (differentKeyRegistration.ok) {
    throw new Error('Register issued second signature for for different master key')
  }
  if (!differentKeyRegistration.error.includes('Already registered')) {
    throw new Error(`Unexpected error from register on second registration. Expected "Already registered", got: ${differentKeyRegistration.error}`)
  }
  log('Reject second registration with different master key ✓')

  log('--- Step 4: Vote ---')
  const voteResult = await client.vote({ credentials, votes: VOTES })
  if (!voteResult.ok) throw new Error(`Vote failed: ${voteResult.error}`)
  const txHash = voteResult.value.txHash
  log('UserOp hash', voteResult.value.userOpHash)
  log('Tx hash', txHash)

  log('--- Step 5: Verify vote via subgraph ---')
  await waitForIndexing(client, credentials, txHash, 'Vote')

  log('=== DONE ===')
  log('Explorer', `https://gnosisscan.io/tx/${txHash}`)

  if (!includeRecast) return txHash

  log('=== Vote recast ===')

  log('--- Step 6: Recast ---')
  const recastResult = await client.recastVote({ credentials, votes: RECAST_VOTES })
  if (!recastResult.ok) throw new Error(`Recast failed: ${recastResult.error}`)
  const recastTxHash = recastResult.value.txHash
  log('UserOp hash', recastResult.value.userOpHash)
  log('Tx hash', recastTxHash)

  log('--- Step 7: Verify recast on subgraph ---')
  await waitForIndexing(client, credentials, recastTxHash, 'Recast vote')

  log('=== DONE ===')
  log('Explorer', `https://gnosisscan.io/tx/${recastTxHash}`)
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
