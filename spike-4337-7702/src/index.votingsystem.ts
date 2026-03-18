import 'dotenv/config'
import { createPublicClient, http, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { gnosisChiado } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { to7702SimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'

import {
  signPaymasterData,
  createStubPaymasterData,
  createVoteCalldata,
  signVotingTransaction,
} from '../../votingSystem/dist/index.js'
import type { VotingTransaction } from '../../votingSystem/dist/index.js'

const CHAIN = gnosisChiado
const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as const
const PAYMASTER_ADDRESS = '0xd4726750592678a45F24734354094717D0362D94' as const
const OPNVOTE_ADDRESS = '0x675ca387A6355cdF9c6710B2D59e19131E79eE39' as const
const ELECTION_ID = 16n

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

function generateDummyVoteData() {
  const randomBytes = (n: number): Hex => {
    const hex = Array.from({ length: n }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    ).join('')
    return `0x${hex}`
  }
  return {
    voteEncrypted: randomBytes(256),
    voteEncryptedUser: randomBytes(45),
    unblindedElectionToken: randomBytes(32),
    unblindedSignature: randomBytes(256),
  }
}

async function main(): Promise<void> {
  log('ERC-4337 + EIP-7702 — votingSystem bundler integration test on Chiado')

  const apiKey = process.env.PIMLICO_API_KEY
  if (!apiKey) throw new Error('PIMLICO_API_KEY required')

  const signerKey = process.env.VERIFYING_SIGNER_KEY as string
  if (!signerKey) throw new Error('VERIFYING_SIGNER_KEY required')

  const svsPrivateKey = process.env.SVS_PRIVATE_KEY as string
  if (!svsPrivateKey) throw new Error('SVS_PRIVATE_KEY required')

  const privateKey = (process.env.EOA_PRIVATE_KEY as Hex) || generatePrivateKey()
  const eoa = privateKeyToAccount(privateKey)
  log('EOA/Voter address', eoa.address)

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http('https://rpc.chiadochain.net'),
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

  const dummyData = generateDummyVoteData()
  const votingTransaction: VotingTransaction = {
    electionID: Number(ELECTION_ID),
    voterAddress: eoa.address,
    encryptedVoteRSA: { hexString: dummyData.voteEncrypted, encryptionType: 'RSA' as any },
    encryptedVoteAES: { hexString: dummyData.voteEncryptedUser, encryptionType: 'AES' as any },
    unblindedElectionToken: {
      hexString: '0x0' + dummyData.unblindedElectionToken.slice(3),
      isMaster: false,
      isBlinded: false,
    },
    unblindedSignature: { hexString: dummyData.unblindedSignature, isBlinded: false },
    svsSignature: null,
  }

  const svsSignature = await signVotingTransaction(votingTransaction, svsPrivateKey)
  log('SVS signature', svsSignature.hexString.slice(0, 20) + '...')

  votingTransaction.svsSignature = svsSignature

  const voteCalldata = createVoteCalldata(votingTransaction) as Hex
  log('Vote calldata', `${voteCalldata.length / 2 - 1} bytes`)

  const stubPaymasterData = createStubPaymasterData() as Hex

  const smartAccountClient = createSmartAccountClient({
    client: publicClient,
    chain: CHAIN,
    account: smartAccount,
    paymaster: {
      async getPaymasterStubData() {
        return {
          paymaster: PAYMASTER_ADDRESS,
          paymasterData: stubPaymasterData,
          paymasterPostOpGasLimit: 1n,
        }
      },
      async getPaymasterData(userOperation) {
        const result = await signPaymasterData(
          {
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
            chainId: CHAIN.id,
            paymasterAddress: PAYMASTER_ADDRESS,
          },
          signerKey,
        )
        log('Paymaster data signed', `${(result.paymasterData as string).length / 2 - 1} bytes`)
        return {
          paymaster: PAYMASTER_ADDRESS,
          paymasterData: result.paymasterData as Hex,
        }
      },
    },
    bundlerTransport: http(pimlicoUrl),
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  })

  const isDeployed = await smartAccount.isDeployed()
  log('Delegation already set?', isDeployed)

  let userOpHash: Hex

  if (!isDeployed) {
    const nonce = await publicClient.getTransactionCount({ address: eoa.address })
    const authorization = await eoa.signAuthorization({
      address: DELEGATION_ADDRESS,
      chainId: CHAIN.id,
      nonce,
    })
    log('7702 authorization signed')
    userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: voteCalldata }],
      authorization,
    })
  } else {
    userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: voteCalldata }],
    })
  }

  log('UserOp hash', userOpHash)
  log('Waiting for receipt...')

  const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash })

  log('=== Result ===')
  log('Success', receipt.success)
  log('Tx hash', receipt.receipt.transactionHash)
  log('Gas used', receipt.actualGasUsed.toString())
  log('Explorer', `https://gnosis-chiado.blockscout.com/tx/${receipt.receipt.transactionHash}`)
}

main().catch(err => {
  console.error('Integration test failed:', err)
  process.exit(1)
})
