/**
 *
 */
import 'dotenv/config'
import { hashMessage, createPublicClient, http, custom, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { gnosisChiado } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { to7702SimpleSmartAccount } from 'permissionless/accounts'

import { createVoteCalldata, EncryptionType } from '../../votingSystem/dist/index.js'
import type { VotingTransaction, EthSignature } from '../../votingSystem/dist/index.js'

const CHAIN = gnosisChiado
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as const
const PAYMASTER_ADDRESS = '0xd4726750592678a45F24734354094717D0362D94' as const
const OPNVOTE_ADDRESS = '0x675ca387A6355cdF9c6710B2D59e19131E79eE39' as const
const ELECTION_ID = 16

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
]

function log(label: string, value?: unknown): void {
  const ts = new Date().toISOString()
  if (value !== undefined) {
    console.log(`[${ts}] ${label}:`, typeof value === 'object' ? JSON.stringify(value) : value)
  } else {
    console.log(`[${ts}] ${label}`)
  }
}

function createSvsForwardTransport(svsUrl: string) {
  return custom({
    async request({ method, params }: { method: string; params: unknown[] }) {
      const res = await fetch(`${svsUrl}/api/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(`SVS forward [${res.status}]: ${json.error ?? JSON.stringify(json)}`)
      const bundlerResponse = json.data
      if (bundlerResponse.error) throw new Error(`Bundler error: ${JSON.stringify(bundlerResponse.error)}`)
      return bundlerResponse.result
    },
  })
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(`POST ${url} [${res.status}]: ${json.error ?? JSON.stringify(json)}`)
  }
  return json.data as T
}

async function main(): Promise<void> {
  log('ERC-4337 + EIP-7702 — SVS integration spike on Chiado')

  const svsUrl = process.env.SVS_URL
  if (!svsUrl) throw new Error('SVS_URL required (e.g. http://localhost:3005)')

  const privateKey = (process.env.EOA_PRIVATE_KEY as Hex) ?? generatePrivateKey()
  const eoa = privateKeyToAccount(privateKey)
  log('EOA/voter address', eoa.address)
  if (!process.env.EOA_PRIVATE_KEY) log('Generated private key (save to reuse)', privateKey)

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http('https://rpc.chiadochain.net'),
  })
  const smartAccount = await to7702SimpleSmartAccount({
    client: publicClient,
    owner: eoa,
    accountLogicAddress: DELEGATION_ADDRESS,
    entryPoint: { address: ENTRY_POINT, version: '0.8' },
  })
  log('Smart account address', smartAccount.address)

  const randHex = (bytes: number) =>
    '0x' +
    Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  const unblindedElectionToken = {
    hexString: '0x03' + randHex(31).slice(2),
    isMaster: false,
    isBlinded: false,
  }
  const unblindedSig = {
    hexString: '0x03' + randHex(255).slice(2),
    isBlinded: false,
  }

  const encryptedVoteRSA = {
    hexString: '0x' + 'ab'.repeat(256),
    encryptionType: EncryptionType.RSA,
  }
  const encryptedVoteAES = {
    hexString: '0x' + 'cd'.repeat(45),
    encryptionType: EncryptionType.AES,
  }

  const votingTransactionWithoutSvs: VotingTransaction = {
    electionID: ELECTION_ID,
    voterAddress: eoa.address,
    encryptedVoteRSA,
    encryptedVoteAES,
    unblindedElectionToken,
    unblindedSignature: unblindedSig,
    svsSignature: null,
  }

  const txJson = JSON.stringify(votingTransactionWithoutSvs)
  const messageHash = hashMessage(txJson)
  const voterSig = await eoa.signMessage({ message: messageHash })
  const voterSignature: EthSignature = { hexString: voterSig }

  log('Calling SVS /sign...')
  const { svsSignature } = await postJson<{ svsSignature: EthSignature }>(
    `${svsUrl}/api/votingTransaction/sign`,
    { votingTransaction: votingTransactionWithoutSvs, voterSignature },
  )
  log('SVS signature', svsSignature.hexString.slice(0, 20) + '...')

  const signedVotingTransaction: VotingTransaction = {
    ...votingTransactionWithoutSvs,
    svsSignature,
  }

  const sponsorTxJson = JSON.stringify(signedVotingTransaction)
  const sponsorMessageHash = hashMessage(sponsorTxJson)
  const sponsorVoterSig = await eoa.signMessage({ message: sponsorMessageHash })
  const sponsorVoterSignature: EthSignature = { hexString: sponsorVoterSig }

  log('Calling SVS /sponsor...')
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
    voterSignature: sponsorVoterSignature,
  })
  log('Paymaster data', `${(paymasterData as string).length / 2 - 1} bytes`)

  const voteCalldata = createVoteCalldata(signedVotingTransaction, OPNVOTE_ABI) as Hex
  log('Vote calldata', `${voteCalldata.length / 2 - 1} bytes`)

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
  log('Delegation already set?', isDeployed)

  const sendParams = {
    calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: voteCalldata }] as const,
    nonce: BigInt(userOpParams.nonce),
  }

  let userOpHash: Hex

  if (!isDeployed) {
    const eoaNonce = await publicClient.getTransactionCount({ address: eoa.address })
    const authorization = await eoa.signAuthorization({
      address: DELEGATION_ADDRESS,
      chainId: CHAIN.id,
      nonce: eoaNonce,
    })
    log('7702 authorization signed')
    userOpHash = await smartAccountClient.sendUserOperation({ ...sendParams, authorization })
  } else {
    userOpHash = await smartAccountClient.sendUserOperation(sendParams)
  }

  log('UserOp hash', userOpHash)
  log('Waiting for receipt...')

  const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash })

  log('=== Result ===')
  log('Success', receipt.success)
  log('Tx hash', receipt.receipt.transactionHash)
  log('Gas used', receipt.actualGasUsed.toString())
  log('Gas cost (xDAI)', (Number(receipt.actualGasCost) / 1e18).toFixed(8))
  log('Explorer', `https://gnosis-chiado.blockscout.com/tx/${receipt.receipt.transactionHash}`)
}

main().catch(err => {
  console.error('SVS integration spike failed:', err)
  process.exit(1)
})
