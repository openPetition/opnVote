import { ethers } from 'ethers'
import {
  getPaymasterHash,
  signPaymasterData,
  createStubPaymasterData,
  createVoteCalldata,
  PaymasterHashParams,
} from './bundler'
import { VotingTransaction, EncryptionType } from '../types/types'
import { RSA_BIT_LENGTH } from '../utils/constants'

const CHAIN_ID = 10200 // Chiado

function makeUserOpParams(overrides: Partial<PaymasterHashParams> = {}): PaymasterHashParams {
  const wallet = ethers.Wallet.createRandom()
  return {
    sender: wallet.address,
    nonce: 1n,
    initCode: '0x',
    callData: '0xdeadbeef',
    verificationGasLimit: 51698n,
    callGasLimit: 74351n,
    paymasterVerificationGasLimit: 35470n,
    paymasterPostOpGasLimit: 1n,
    preVerificationGas: 93194n,
    maxPriorityFeePerGas: 1650000000n,
    maxFeePerGas: 1650000008n,
    validUntil: Math.floor(Date.now() / 1000) + 3600,
    validAfter: Math.floor(Date.now() / 1000) - 120,
    chainId: CHAIN_ID,
    paymasterAddress: ethers.ZeroAddress,
    ...overrides,
  }
}

function makeVotingTransaction(svsSignature: string | null = null): VotingTransaction {
  const wallet = ethers.Wallet.createRandom()
  return {
    electionID: 1,
    voterAddress: wallet.address,
    encryptedVoteRSA: {
      hexString: '0x' + '1'.repeat(RSA_BIT_LENGTH / 4),
      encryptionType: EncryptionType.RSA,
    },
    encryptedVoteAES: { hexString: '0x' + '1'.repeat(80), encryptionType: EncryptionType.AES },
    unblindedElectionToken: {
      hexString: '0x' + BigInt(3).toString(16).padStart(64, '0'),
      isMaster: false,
      isBlinded: false,
    },
    unblindedSignature: { hexString: '0x' + '1'.repeat(RSA_BIT_LENGTH / 4), isBlinded: false },
    svsSignature: svsSignature ? { hexString: svsSignature } : null,
  }
}

describe('getPaymasterHash', () => {
  it('returns a 32-byte hex hash', () => {
    const hash = getPaymasterHash(makeUserOpParams())
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('produces different hashes for different senders', () => {
    const hash1 = getPaymasterHash(
      makeUserOpParams({ sender: ethers.Wallet.createRandom().address }),
    )
    const hash2 = getPaymasterHash(
      makeUserOpParams({ sender: ethers.Wallet.createRandom().address }),
    )
    expect(hash1).not.toEqual(hash2)
  })

  it('produces different hashes for different gas limits', () => {
    const hash1 = getPaymasterHash(makeUserOpParams({ callGasLimit: 100000n }))
    const hash2 = getPaymasterHash(makeUserOpParams({ callGasLimit: 200000n }))
    expect(hash1).not.toEqual(hash2)
  })

  it('is deterministic for the same inputs', () => {
    const params = makeUserOpParams()
    expect(getPaymasterHash(params)).toEqual(getPaymasterHash(params))
  })
})

describe('signPaymasterData', () => {
  const signerWallet = ethers.Wallet.createRandom()

  it('returns paymasterData', async () => {
    const result = await signPaymasterData(makeUserOpParams(), signerWallet.privateKey)
    expect(result.paymasterData).toMatch(/^0x[0-9a-f]+$/)
  })

  it('paymasterData is validityData (64 bytes) + signature (65 bytes) = 129 bytes', async () => {
    const result = await signPaymasterData(makeUserOpParams(), signerWallet.privateKey)
    // 0x + 129 bytes = 0x + 258 hex chars
    expect(result.paymasterData.length).toEqual(2 + 258)
  })

  it('signature can be recovered to the signer address', async () => {
    const params = makeUserOpParams()
    const hash = getPaymasterHash(params)

    const result = await signPaymasterData(params, signerWallet.privateKey)

    // Extract signature: skip 64 bytes of validityData
    const sig = '0x' + result.paymasterData.slice(2 + 128)
    const recovered = ethers.verifyMessage(ethers.getBytes(hash), sig)
    expect(recovered.toLowerCase()).toEqual(signerWallet.address.toLowerCase())
  })
})

describe('createStubPaymasterData', () => {
  const validUntil = Math.floor(Date.now() / 1000) + 3600
  const validAfter = Math.floor(Date.now() / 1000) - 120

  it('returns validityData (64 bytes) + stub sig (65 bytes) = 129 bytes', () => {
    const stub = createStubPaymasterData(validUntil, validAfter)
    expect(stub.length).toEqual(2 + 258)
  })

  it('stub signature is valid ECDSA format (non-zero, v=0x1c)', () => {
    const stub = createStubPaymasterData(validUntil, validAfter)
    const stubSig = '0x' + stub.slice(2 + 128)
    expect(stubSig).toMatch(/1c$/) // v = 28
    expect(stubSig.length).toEqual(2 + 130) // 65 bytes
  })
})

describe('createVoteCalldata', () => {
  const VOTE_ABI = [
    'function vote(uint256 electionId, address voter, bytes svsSignature, bytes voteEncrypted, bytes voteEncryptedUser, bytes unblindedElectionToken, bytes unblindedSignature)',
  ]

  it('returns valid calldata with empty svsSignature for recasts', () => {
    const tx = makeVotingTransaction(null)
    const calldata = createVoteCalldata(tx, VOTE_ABI)
    const iface = new ethers.Interface(VOTE_ABI)
    const decoded = iface.decodeFunctionData('vote', calldata)
    expect(ethers.hexlify(decoded[2])).toBe('0x')
  })

  it('returns valid hex calldata starting with vote() selector', () => {
    const tx = makeVotingTransaction('0x' + '1'.repeat(130))
    const calldata = createVoteCalldata(tx, VOTE_ABI)
    const iface = new ethers.Interface([
      'function vote(uint256,address,bytes,bytes,bytes,bytes,bytes)',
    ])
    const selector = iface.getFunction('vote')!.selector
    expect(calldata.startsWith(selector)).toBe(true)
  })

  it('calldata includes the election ID', () => {
    const tx = makeVotingTransaction('0x' + '1'.repeat(130))
    const calldata = createVoteCalldata(tx, VOTE_ABI)
    // electionID=1 should appear as 0x01 padded to 32 bytes
    expect(calldata).toContain('0000000000000000000000000000000000000000000000000000000000000001')
  })
})
