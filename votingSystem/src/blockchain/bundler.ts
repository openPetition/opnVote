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
 * Signs the paymaster hash and returns the encoded paymasterData field
 * The returned paymasterData is 129 bytes: 64 bytes validity windows, a 65-byte ECDSA signature.
 * @param {PaymasterHashParams} params - UserOperation fields and paymaster metadata
 * @param {string} signerKey - Private key of the paymaster
 * @returns {Promise<PaymasterDataResult>} The encoded paymasterData ready to include in a UserOperation
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
 * Creates a stub paymasterData for gas estimation.
 * Uses a valid-format dummy ECDSA signature so that `ECDSA.recover` does not revert during simulation.
 * The recovered address will not match the real signer, so `sigFailed=true` is returned by the paymaster — which is acceptable during gas estimation.
 * @param {number} validUntil - Unix timestamp after which the paymaster approval expires
 * @param {number} validAfter - Unix timestamp before which the paymaster approval is not valid
 * @returns {string} Encoded paymasterData (129 bytes) suitable for use in `getPaymasterStubData`
 */
export function createStubPaymasterData(validUntil: number, validAfter: number): string {
  // Dummy ECDSA signature — non-zero so ECDSA.recover does not revert during simulation
  const stubSig =
    '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
  const abiCoder = new ethers.AbiCoder()
  const validityData = abiCoder.encode(['uint48', 'uint48'], [validUntil, validAfter])
  return ethers.concat([validityData, stubSig])
}

/**
 * ABI-encodes the `vote()` calldata for the OpnVote contract.
 * @param {VotingTransaction} votingTransaction - The fully populated voting transaction, including the SVS signature
 * @param {ethers.Interface | ethers.InterfaceAbi} opnVoteABI - ABI of the OpnVote contract
 * @returns {string} Hex-encoded calldata for the `vote()` function
 * @throws {Error} if the SVS signature is missing from the voting transaction
 */
export function createVoteCalldata(
  votingTransaction: VotingTransaction,
  opnVoteABI: ethers.Interface | ethers.InterfaceAbi,
): string {
  if (!votingTransaction.svsSignature) {
    throw new Error('SVS signature required to create vote calldata')
  }
  const iface =
    opnVoteABI instanceof ethers.Interface ? opnVoteABI : new ethers.Interface(opnVoteABI)
  return iface.encodeFunctionData('vote', [
    votingTransaction.electionID,
    votingTransaction.voterAddress,
    votingTransaction.svsSignature.hexString,
    votingTransaction.encryptedVoteRSA.hexString,
    votingTransaction.encryptedVoteAES.hexString,
    votingTransaction.unblindedElectionToken.hexString,
    votingTransaction.unblindedSignature.hexString,
  ])
}
