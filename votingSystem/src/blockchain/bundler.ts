import { ethers } from 'ethers'
import { VotingTransaction } from '../types/types'

function packUint128(high: bigint, low: bigint): string {
  return ethers.zeroPadValue(ethers.toBeHex((high << 128n) | low), 32)
}

export type PaymasterHashParams = {
  sender: string
  nonce: bigint
  initCode: string
  callData: string
  verificationGasLimit: bigint
  callGasLimit: bigint
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
  preVerificationGas: bigint
  maxPriorityFeePerGas: bigint
  maxFeePerGas: bigint
  validUntil: number
  validAfter: number
  chainId: number
  paymasterAddress: string
}

/**
 * Computes the hash that the paymaster signs
 * Mirrors getHash() -  must stay in sync with the on-chain implementation
 * @param {PaymasterHashParams} params - UserOperation fields and paymaster metadata
 * @returns {string} 32-byte keccak256 hash
 */
export function getPaymasterHash(params: PaymasterHashParams): string {
  const abiCoder = new ethers.AbiCoder()

  const accountGasLimits = packUint128(params.verificationGasLimit, params.callGasLimit)
  const paymasterGasLimitPacked =
    (params.paymasterVerificationGasLimit << 128n) | params.paymasterPostOpGasLimit
  const gasFees = packUint128(params.maxPriorityFeePerGas, params.maxFeePerGas)

  const encoded = abiCoder.encode(
    [
      'address',
      'uint256',
      'bytes32',
      'bytes32',
      'bytes32',
      'uint256',
      'uint256',
      'bytes32',
      'uint256',
      'address',
      'uint48',
      'uint48',
    ],
    [
      params.sender,
      params.nonce,
      ethers.keccak256(params.initCode),
      ethers.keccak256(params.callData),
      accountGasLimits,
      paymasterGasLimitPacked,
      params.preVerificationGas,
      gasFees,
      BigInt(params.chainId),
      params.paymasterAddress,
      params.validUntil,
      params.validAfter,
    ],
  )

  return ethers.keccak256(encoded)
}

export type PaymasterDataResult = {
  paymasterData: string
}

/**
 * Signs the paymaster hash and returns the encoded paymasterData
 * The returned paymasterData is 129 bytes: 64 bytes validity windows, 65-byte ECDSA signature.
 * @param {PaymasterHashParams} params - UserOperation fields and paymaster metadata
 * @param {string} signerKey - Private key of paymaster
 * @returns {Promise<PaymasterDataResult>} The encoded paymasterData
 */
export async function signPaymasterData(
  params: PaymasterHashParams,
  signerKey: string,
): Promise<PaymasterDataResult> {
  const hash = getPaymasterHash(params)

  const wallet = new ethers.Wallet(signerKey)
  const signature = await wallet.signMessage(ethers.getBytes(hash))

  const abiCoder = new ethers.AbiCoder()
  const validityData = abiCoder.encode(['uint48', 'uint48'], [params.validUntil, params.validAfter])
  const paymasterData = ethers.concat([validityData, signature])

  return { paymasterData }
}

/**
 * Creates paymasterData for gas estimation.
 * @param {number} validUntil - Expiration time of the signature
 * @param {number} validAfter - Start time of the signature validity
 * @returns {string} Encoded paymasterData (129 bytes)
 */
export function createStubPaymasterData(validUntil: number, validAfter: number): string {
  const stubSig =
    '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
  const abiCoder = new ethers.AbiCoder()
  const validityData = abiCoder.encode(['uint48', 'uint48'], [validUntil, validAfter])
  return ethers.concat([validityData, stubSig])
}

/**
 * ABI-encodes the `vote()` calldata
 * @param {VotingTransaction} votingTransaction
 * @param {ethers.Interface | ethers.InterfaceAbi} opnVoteABI
 * @returns {string} Hex-encoded calldata for vote()
 */
export function createVoteCalldata(
  votingTransaction: VotingTransaction,
  opnVoteABI: ethers.Interface | ethers.InterfaceAbi,
): string {
  const svsSignatureHex = votingTransaction.svsSignature
    ? votingTransaction.svsSignature.hexString
    : '0x'
  const iface =
    opnVoteABI instanceof ethers.Interface ? opnVoteABI : new ethers.Interface(opnVoteABI)
  return iface.encodeFunctionData('vote', [
    votingTransaction.electionID,
    votingTransaction.voterAddress,
    svsSignatureHex,
    votingTransaction.encryptedVoteRSA.hexString,
    votingTransaction.encryptedVoteAES.hexString,
    votingTransaction.unblindedElectionToken.hexString,
    votingTransaction.unblindedSignature.hexString,
  ])
}
