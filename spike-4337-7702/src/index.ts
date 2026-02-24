import 'dotenv/config'
import { createPublicClient, http, zeroAddress, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { gnosisChiado } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { to7702SimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'

const CHAIN = gnosisChiado
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const

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

async function main(): Promise<void> {
  log('ERC-4337 + EIP-7702 Spike on Gnosis Chiado')

  const apiKey = process.env.PIMLICO_API_KEY
  if (!apiKey) {
    throw new Error('PIMLICO_API_KEY is required')
  }

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
    entryPoint: { address: '0x4337084d9e255ff0702461cf8895ce9e3b5ff108', version: '0.8' },
  })
  log('Smart account address (== EOA address), smartAccount.address')

  const sponsorshipPolicyId = process.env.SPONSORSHIP_POLICY_ID
  const smartAccountClient = createSmartAccountClient({
    client: publicClient,
    chain: CHAIN,
    account: smartAccount,
    paymaster: pimlicoClient,
    paymasterContext: sponsorshipPolicyId ? { sponsorshipPolicyId } : undefined,
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
