import 'dotenv/config'
import {
  createPublicClient,
  concat,
  encodeAbiParameters,
  http,
  keccak256,
  pad,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { gnosisChiado } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { to7702SimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'

const CHAIN = gnosisChiado
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as const
const PAYMASTER_ADDRESS = '0xd4726750592678a45F24734354094717D0362D94' as const

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

async function main(): Promise<void> {
  log('ERC-4337 + EIP-7702 Spike — Own Paymaster on Chiado')

  const apiKey = process.env.PIMLICO_API_KEY
  if (!apiKey) throw new Error('PIMLICO_API_KEY required')

  const signerKey = process.env.VERIFYING_SIGNER_KEY as Hex
  if (!signerKey) throw new Error('VERIFYING_SIGNER_KEY required')
  const signer = privateKeyToAccount(signerKey)
  log('Verifying signer', signer.address)

  const privateKey = (process.env.EOA_PRIVATE_KEY as Hex) || generatePrivateKey()
  const eoa = privateKeyToAccount(privateKey)
  log('EOA address', eoa.address)
  log('Private key', privateKey)

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http('https://rpc.chiadochain.net'),
  })
  const pimlicoUrl = getPimlicoUrl(apiKey)
  const pimlicoClient = createPimlicoClient({
    chain: CHAIN,
    transport: http(pimlicoUrl),
  })
  log('Clients created')

  const smartAccount = await to7702SimpleSmartAccount({
    client: publicClient,
    owner: eoa,
    accountLogicAddress: DELEGATION_ADDRESS,
    entryPoint: { address: ENTRY_POINT, version: '0.8' },
  })
  log('Smart account (== EOA)', smartAccount.address)

  const now = Math.floor(Date.now() / 1000)
  const validAfter = now
  const validUntil = now + 600 // 10 min validity

  const validityData = encodeAbiParameters(
    [{ type: 'uint48' }, { type: 'uint48' }],
    [validUntil, validAfter],
  )
  const sig = await signer.signMessage({ message: 'stub' })

  const smartAccountClient = createSmartAccountClient({
    client: publicClient,
    chain: CHAIN,
    account: smartAccount,
    paymaster: {
      async getPaymasterStubData() {
        return {
          paymaster: PAYMASTER_ADDRESS,
          paymasterData: concat([validityData, sig]) as Hex,
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
        log('Paymaster signature created')

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
  log('SmartAccountClient created')

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

    log('Sending UserOp with 7702 authorization...')
    userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{ to: zeroAddress, value: 0n, data: '0x' as Hex }],
      authorization,
    })
  } else {
    log('Sending UserOp (delegation already active)...')
    userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{ to: zeroAddress, value: 0n, data: '0x' as Hex }],
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
  log('Explorer', `https://gnosis-chiado.blockscout.com/tx/${receipt.receipt.transactionHash}`)
}

main().catch(err => {
  console.error('Spike failed:', err)
  process.exit(1)
})
