import 'dotenv/config'
import {
  createPublicClient,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  keccak256,
  pad,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { gnosis } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { to7702SimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'

const CHAIN = gnosis
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as const
const PAYMASTER_ADDRESS = '0x53f9b337ce2Ea37D87dBAf0D08a9B931ef9D7eae' as const
const OPNVOTE_ADDRESS = '0xa36f6cF07eF1DeD3B8B4283E779A4514E30576a8' as const
const ELECTION_ID = 17n

const voteAbi = [{
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
}] as const

function getPimlicoUrl(apiKey: string): string {
  return `https://api.pimlico.io/v2/${CHAIN.id}/rpc?apikey=${apiKey}`
}

function log(label: string, value?: unknown): void {
  const ts = new Date().toISOString()
  if (value !== undefined) {
    console.log(`[${ts}] ${label}:`, typeof value === 'object' ? JSON.stringify(value) : value)
  } else {
    console.log(`[${ts}] ${label}`)
  }
}

function packUint128(high: bigint, low: bigint): Hex {
  return pad(toHex((high << 128n) | low), { size: 32 })
}

function getPaymasterHash(params: {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  verificationGasLimit: bigint
  callGasLimit: bigint
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
  preVerificationGas: bigint
  maxPriorityFeePerGas: bigint
  maxFeePerGas: bigint
  validUntil: number
  validAfter: number
}): Hex {
  const accountGasLimits = packUint128(params.verificationGasLimit, params.callGasLimit)
  const paymasterGasData = packUint128(
    params.paymasterVerificationGasLimit,
    params.paymasterPostOpGasLimit,
  )
  const gasFees = packUint128(params.maxPriorityFeePerGas, params.maxFeePerGas)

  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint48' },
        { type: 'uint48' },
      ],
      [
        params.sender,
        params.nonce,
        keccak256(params.initCode),
        keccak256(params.callData),
        accountGasLimits,
        BigInt(paymasterGasData),
        params.preVerificationGas,
        gasFees,
        BigInt(CHAIN.id),
        PAYMASTER_ADDRESS,
        params.validUntil,
        params.validAfter,
      ],
    ),
  )
}

// Generate dummy vote data with correct byte lengths
function generateDummyVoteData() {
  const randomBytes = (n: number): Hex => {
    const hex = Array.from({ length: n }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('')
    return `0x${hex}`
  }

  return {
    voteEncrypted: randomBytes(256),          // RSA 2048 encrypted vote
    voteEncryptedUser: randomBytes(45),       // AES-GCM: 12 IV + 17 ciphertext + 16 tag
    unblindedElectionToken: randomBytes(32),  // 32 bytes
    unblindedSignature: randomBytes(256),     // RSA 2048 signature
  }
}

// Create a valid SVS signature matching the contract's _verify logic
async function createSvsSignature(
  svsPrivateKey: Hex,
  electionId: bigint,
  voter: Address,
  voteEncrypted: Hex,
  voteEncryptedUser: Hex,
  unblindedElectionToken: Hex,
  unblindedSignature: Hex,
): Promise<Hex> {
  const svsAccount = privateKeyToAccount(svsPrivateKey)

  // Matches: keccak256(abi.encode(electionId, voter, voteEncrypted, voteEncryptedUser, unblindedElectionToken, unblindedSignature))
  const encoded = encodeAbiParameters(
    [
      { type: 'uint256' },
      { type: 'address' },
      { type: 'bytes' },
      { type: 'bytes' },
      { type: 'bytes' },
      { type: 'bytes' },
    ],
    [electionId, voter, voteEncrypted, voteEncryptedUser, unblindedElectionToken, unblindedSignature],
  )
  const dataHash = keccak256(encoded)

  // signMessage adds EIP-191 prefix, matching contract's toEthSignedMessageHash().recover()
  return svsAccount.signMessage({ message: { raw: dataHash } })
}

async function main(): Promise<void> {
  log('ERC-4337 + EIP-7702 Spike — Real Vote on Chiado')

  const apiKey = process.env.PIMLICO_API_KEY
  if (!apiKey) throw new Error('PIMLICO_API_KEY required')

  const signerKey = process.env.VERIFYING_SIGNER_KEY as Hex
  if (!signerKey) throw new Error('VERIFYING_SIGNER_KEY required')
  const signer = privateKeyToAccount(signerKey)

  const svsPrivateKey = process.env.SVS_PRIVATE_KEY as Hex
  if (!svsPrivateKey) throw new Error('SVS_PRIVATE_KEY required')
  const svsAccount = privateKeyToAccount(svsPrivateKey)
  log('SVS signer address', svsAccount.address)

  const privateKey = (process.env.EOA_PRIVATE_KEY as Hex) || generatePrivateKey()
  const eoa = privateKeyToAccount(privateKey)
  log('EOA/Voter address', eoa.address)
  log('Private key', privateKey)

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http('https://rpc.gnosischain.com'),
  })
  const pimlicoUrl = getPimlicoUrl(apiKey)
  const pimlicoClient = createPimlicoClient({
    chain: CHAIN,
    transport: http(pimlicoUrl),
  })

  const smartAccount = await to7702SimpleSmartAccount({
    client: publicClient,
    owner: eoa,
    accountLogicAddress: DELEGATION_ADDRESS,
    entryPoint: { address: ENTRY_POINT, version: '0.8' },
  })
  log('Smart account (== EOA)', smartAccount.address)

  // --- Build vote calldata ---
  const voter = eoa.address
  const dummyData = generateDummyVoteData()

  const svsSignature = await createSvsSignature(
    svsPrivateKey,
    ELECTION_ID,
    voter,
    dummyData.voteEncrypted,
    dummyData.voteEncryptedUser,
    dummyData.unblindedElectionToken,
    dummyData.unblindedSignature,
  )
  log('SVS signature created (65 bytes)')

  const voteCalldata = encodeFunctionData({
    abi: voteAbi,
    functionName: 'vote',
    args: [
      ELECTION_ID,
      voter,
      svsSignature,
      dummyData.voteEncrypted,
      dummyData.voteEncryptedUser,
      dummyData.unblindedElectionToken,
      dummyData.unblindedSignature,
    ],
  })
  log('Vote calldata encoded', `${voteCalldata.length / 2 - 1} bytes`)

  // --- Paymaster setup ---
  const now = Math.floor(Date.now() / 1000)
  const validAfter = now - 120
  const validUntil = now + 3600

  const validityData = encodeAbiParameters(
    [{ type: 'uint48' }, { type: 'uint48' }],
    [validUntil, validAfter],
  )
  const stubSig = await signer.signMessage({ message: 'stub' })

  const smartAccountClient = createSmartAccountClient({
    client: publicClient,
    chain: CHAIN,
    account: smartAccount,
    paymaster: {
      async getPaymasterStubData() {
        return {
          paymaster: PAYMASTER_ADDRESS,
          paymasterData: concat([validityData, stubSig]) as Hex,
        }
      },
      async getPaymasterData(userOperation) {
        const hash = getPaymasterHash({
          sender: userOperation.sender,
          nonce: userOperation.nonce,
          initCode: '0x',
          callData: userOperation.callData,
          verificationGasLimit: userOperation.verificationGasLimit ?? 0n,
          callGasLimit: userOperation.callGasLimit ?? 0n,
          paymasterVerificationGasLimit: userOperation.paymasterVerificationGasLimit ?? 0n,
          paymasterPostOpGasLimit: userOperation.paymasterPostOpGasLimit ?? 0n,
          preVerificationGas: userOperation.preVerificationGas ?? 0n,
          maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas ?? 0n,
          maxFeePerGas: userOperation.maxFeePerGas ?? 0n,
          validUntil,
          validAfter,
        })

        const signature = await signer.signMessage({ message: { raw: hash } })

        return {
          paymaster: PAYMASTER_ADDRESS,
          paymasterData: concat([validityData, signature]) as Hex,
        }
      },
    },
    bundlerTransport: http(pimlicoUrl),
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast
      },
    },
  })

  // --- Send UserOp ---
  const isDeployed = await smartAccount.isDeployed()
  log('Delegation already set?', isDeployed)

  let userOpHash: Hex

  if (!isDeployed) {
    const nonce = await publicClient.getTransactionCount({ address: eoa.address })
    log('EOA nonce', nonce)

    const authorization = await eoa.signAuthorization({
      address: DELEGATION_ADDRESS,
      chainId: CHAIN.id,
      nonce,
    })
    log('7702 authorization signed')

    log('Sending vote UserOp with 7702 authorization...')
    userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: voteCalldata }],
      authorization,
    })
  } else {
    log('Sending vote UserOp (delegation already active)...')
    userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: voteCalldata }],
    })
  }

  log('UserOp hash', userOpHash)

  log('Waiting for receipt...')
  const receipt = await smartAccountClient.waitForUserOperationReceipt({
    hash: userOpHash,
  })

  log('=== Result ===')
  log('Success', receipt.success)
  log('Block', receipt.receipt.blockNumber.toString())
  log('Tx hash', receipt.receipt.transactionHash)
  log('Gas used', receipt.actualGasUsed.toString())
  log('Gas cost (wei)', receipt.actualGasCost.toString())
  log('Gas cost (xDAI)', (Number(receipt.actualGasCost) / 1e18).toFixed(8))
  log('Explorer', `https://gnosisscan.io/tx/${receipt.receipt.transactionHash}`)
}

main().catch(err => {
  console.error('Spike failed:', err)
  process.exit(1)
})
