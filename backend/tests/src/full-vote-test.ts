import 'dotenv/config'
import { createSign } from 'node:crypto'
import { hashMessage, createPublicClient, http, custom, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { gnosis } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { to7702SimpleSmartAccount } from 'permissionless/accounts'
import {
  generateMasterTokenAndMasterR,
  deriveElectionUnblindedToken,
  deriveElectionR,
  blindToken,
  unblindSignature,
  createVoterCredentials,
  encryptVotes,
  createVotingTransactionWithoutSVSSignature,
  addSVSSignatureToVotingTransaction,
  createVoteCalldata,
  EncryptionType,
  VoteOption,
} from 'votingsystem'
import type { RSAParams, EthSignature, EncryptionKey } from 'votingsystem'

const CHAIN = gnosis
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as const
const PAYMASTER_ADDRESS = '0x53f9b337ce2Ea37D87dBAf0D08a9B931ef9D7eae' as const
const OPNVOTE_ADDRESS = '0xa36f6cF07eF1DeD3B8B4283E779A4514E30576a8' as const

const OPNVOTE_ABI = [
  {
    type: 'function',
    name: 'vote',
    inputs: [
      { name: 'electionId', type: 'uint256' },
      { name: 'voter', type: 'address' },
      { name: 'svsSignature', type: 'bytes' },
      { name: 'voteEncrypted', type: 'bytes' },
      { name: 'voteEncryptedUser', type: 'bytes' },
      { name: 'unblindedElectionToken', type: 'bytes' },
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

  const rpcUrl = process.env.RPC_PROVIDER
  if (!rpcUrl) throw new Error('RPC_PROVIDER required in .env')

  const apPrivKey = process.env.AP_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!apPrivKey) throw new Error('AP_PRIVATE_KEY required in .env (PEM, use \\n for newlines)')

  const userId = Math.floor(Date.now() / 1000) % 1_000_000_000

  log('Fetching election keys from subgraph...')
  const { election } = await querySubgraph<{
    election: { publicKey: string; registerPublicKeyE: string; registerPublicKeyN: string } | null
  }>(
    subgraphUrl,
    `{ election(id: "${ELECTION_ID}") { publicKey registerPublicKeyE registerPublicKeyN } }`,
  )
  if (!election) throw new Error(`Election ${ELECTION_ID} not found in subgraph`)
  if (!election.registerPublicKeyE || !election.registerPublicKeyN)
    throw new Error(`Register public key not set on-chain for election ${ELECTION_ID}`)
  if (!election.publicKey)
    throw new Error(`Coordinator public key not set on-chain for election ${ELECTION_ID}`)

  const registerParams: RSAParams = {
    N: BigInt(election.registerPublicKeyN),
    e: BigInt(election.registerPublicKeyE),
    NbitLength: 2048,
  }

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

  const { masterToken, masterR } = generateMasterTokenAndMasterR()
  const unblindedElectionToken = deriveElectionUnblindedToken(ELECTION_ID, masterToken)
  const electionR = deriveElectionR(ELECTION_ID, masterR, unblindedElectionToken, registerParams)
  const blindedToken = blindToken(unblindedElectionToken, electionR, registerParams)

  const { blindedSignature: blindedSigHex } = await postJson<{ blindedSignature: string }>(
    `${registerUrl}/api/sign`,
    { token: blindedToken },
    { Authorization: `Bearer ${voterJwt}` },
  )

  const unblindedSig = unblindSignature(
    { hexString: blindedSigHex, isBlinded: true },
    electionR,
    registerParams,
  )

  log('--- Step 3: Voter credentials ---')
  const voterCredentials = createVoterCredentials(
    unblindedSig,
    unblindedElectionToken,
    masterToken,
    ELECTION_ID,
  )
  const voterAccount = privateKeyToAccount(voterCredentials.voterWallet.privateKey as Hex)
  log('Voter address', voterAccount.address)

  log('--- Step 4: SVS sign ---')
  const votes = [{ value: VoteOption.Yes }, { value: VoteOption.No }, { value: VoteOption.No }]
  const encryptedVotesRSA = await encryptVotes(votes, coordinatorKey, EncryptionType.RSA)
  const encryptedVotesAES = await encryptVotes(
    votes,
    voterCredentials.encryptionKey,
    EncryptionType.AES,
  )
  const votingTransaction = createVotingTransactionWithoutSVSSignature(
    voterCredentials,
    encryptedVotesRSA,
    encryptedVotesAES,
  )

  const msgHash = hashMessage(JSON.stringify(votingTransaction))
  const voterSig = await voterAccount.signMessage({ message: msgHash })
  const voterSignature: EthSignature = { hexString: voterSig }

  const svsSignData = await postJson<Record<string, unknown>>(
    `${svsUrl}/api/votingTransaction/sign`,
    { votingTransaction, voterSignature },
  )
  const svsSignatureRaw = ((svsSignData as any).blindedSignature ??
    (svsSignData as any).svsSignature) as EthSignature
  if (!svsSignatureRaw?.hexString)
    throw new Error(`SVS sign: unexpected response shape: ${JSON.stringify(svsSignData)}`)
  log('SVS signature received ✓', svsSignatureRaw.hexString.slice(0, 20) + '...')

  const signedVotingTransaction = addSVSSignatureToVotingTransaction(
    votingTransaction,
    svsSignatureRaw,
  )

  log('--- Step 5: SVS sponsor ---')
  const sponsorMsgHash = hashMessage(JSON.stringify(signedVotingTransaction))
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
    votingTransaction: signedVotingTransaction,
    voterSignature: { hexString: sponsorSig },
  })

  log('--- Step 6: ERC-4337 submit ---')
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

  const voteCalldata = createVoteCalldata(signedVotingTransaction, OPNVOTE_ABI) as Hex

  const smartAccountClient = createSmartAccountClient({
    client: publicClient,
    chain: CHAIN,
    account: smartAccount,
    paymaster: {
      async getPaymasterStubData() {
        return {
          paymaster: PAYMASTER_ADDRESS,
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
    calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: voteCalldata }] as const,
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

  log('=== Vote recast ===') // no 7702 setup, no SVS sign needed

  log('--- Step 4 (recast): No SVS sign ---')
  const recastVotes = [
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
  const recastVotingTransaction = createVotingTransactionWithoutSVSSignature(
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
          paymaster: PAYMASTER_ADDRESS,
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
    calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: recastVoteCalldata }] as const,
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
