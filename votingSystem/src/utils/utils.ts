import {
  BlsParams,
  ElectionCredentials,
  EncryptedVotes,
  EncryptionKey,
  EncryptionType,
  EthSignature,
  MasterKey,
  R,
  RecastingVotingTransaction,
  BlsSignature,
  Token,
  Vote,
  VoteOption,
  VotingTransaction,
} from '../types/types'
import { ethers, verifyTypedData } from 'ethers'
import { bls12_381 } from '@noble/curves/bls12-381'
import { BLS_G1_HEX_LENGTH, BLS_G2_HEX_LENGTH, RSA_BIT_LENGTH } from './constants'

/**
 * Validates a hexadecimal string.
 * @param hexStringObject - An object containing a hexadecimal string to be validated.
 * @param expectedLength - The expected length of the hexadecimal string..
 * @param shouldBeLowerCase - Optional. If true, validates that the hex string is lowercase. Default is false.
 * @param allowZero - Optional. If true, allows the hex string to represent zero. Default is false.
 * @throws Will throw an error if the hexadecimal string is invalid, of incorrect length, or represents zero (when allowZero is false).
 */
export function validateHexString(
  hexStringObject: { hexString: string },
  expectedLength: number,
  shouldBeLowerCase: boolean = false,
  allowZero: boolean = false,
): void {
  if (hexStringObject.hexString.length !== expectedLength) {
    throw new Error(
      `Invalid token length. Expected length: ${expectedLength}, but got: ${hexStringObject.hexString.length}. Token: ${hexStringObject.hexString}`,
    )
  }

  if (!isValidHex(hexStringObject.hexString, shouldBeLowerCase, allowZero)) {
    throw new Error(`Invalid token format. Token: ${hexStringObject.hexString}`)
  }
}

/**
 * Checks if a string is a valid hexadecimal format.
 * @param str - The string to be checked.
 * @param shouldBeLowerCase - Optional. If true, checks if the string is in lowercase. Default is false.
 * @param allowZero - Optional. If true, allows the hex string to represent zero. Default is false.
 * @returns True if the string is a valid hexadecimal that meets all criteria, false otherwise.
 */
export function isValidHex(
  str: string,
  shouldBeLowerCase: boolean = false,
  allowZero: boolean = false,
): boolean {
  if (!str || str.length < 3) {
    return false
  }

  str = str.startsWith('0x') ? str.substring(2) : str

  const regexp = /^[0-9a-fA-F]+$/

  if (!regexp.test(str)) {
    return false
  }

  if (shouldBeLowerCase && str !== str.toLowerCase()) {
    return false
  }

  if (!allowZero && BigInt(`0x${str}`) === BigInt(0)) {
    return false
  }

  if (str.length % 2 !== 0) {
    return false
  }

  return true
}

/**
 * Validates an election ID.
 * @param electionID - The election ID to be checked.
 * @throws Will throw an error if election ID is a negative number or bigger than 1,000,000.
 */
export function validateElectionID(electionID: number) {
  if (!Number.isInteger(electionID)) {
    throw new Error(`Invalid election ID: ${electionID}. Must be an integer.`)
  }

  if (electionID < 0 || electionID > 1000000) {
    throw new Error('Election ID out of range')
  }
}

/**
 * Converts a hexadecimal string to a Base64 string.
 *
 * @param hexStringObject - An object containing a hexadecimal string to be converted.
 * @returns The Base64 string representation of the hexadecimal string.
 */
export function hexStringToBase64(
  hexStringObject: { hexString: string },
  expectedHexLength: number,
): string {
  validateHexString(hexStringObject, expectedHexLength)
  return ethers.encodeBase64(ethers.getBytes(hexStringObject.hexString))
}

/**
 * Validates a Token (unblinded keccak256 hash or blinded G1 point)
 * @param token - Token to be validated
 * @throws if isBlinded is not a boolean; if the token is malformed, or weak
 */
export function validateToken(token: Token): void {
  if (typeof token.isBlinded !== 'boolean') {
    throw new Error('Token: isBlinded must be set (boolean)')
  }

  const expectedLength = token.isBlinded
    ? BLS_G1_HEX_LENGTH // blinded: uncompressed BLS12-381 G1 point
    : 66                // unblinded: 32-byte keccak256 hash

  validateHexString(token, expectedLength, true)

  // Sanity check for blinded token
  if (token.isBlinded) {
    let g1Point: ReturnType<typeof bls12_381.curves.G1.fromHex>
    try {
      g1Point = bls12_381.curves.G1.fromHex(token.hexString.substring(2)) // enforces point is on-curve and rejects small sub-groups
    } catch {
      throw new Error('Blinded token is not a valid G1 point')
    }
    if (g1Point.is0()) {
      throw new Error('Blinded token is G1 identity point')
    }
  }

  // Sanity check
  const tokenBig = hexStringToBigInt(token.hexString)
  if (tokenBig <= 2n) {
    throw new Error('Token value is too low')
  }
}

/**
 * Validates BLS12-381 parameters and rejects invalid or weak pairs
 * @param blsParams - BlsParams object to be validated
 * @throws if pk is off-curve, weak or the identity point; if sk and pk dont match; if pk is out of range
 */
export function validateBlsParams(blsParams: BlsParams): void {
  validateHexString({ hexString: blsParams.pk }, BLS_G2_HEX_LENGTH, true)

  let pkPoint: ReturnType<typeof bls12_381.curves.G2.fromHex>
  try {
    pkPoint = bls12_381.curves.G2.fromHex(blsParams.pk.substring(2)) // enforces point is on-curve and rejects small sub-groups
  } catch {
    throw new Error('BLS pk is not a valid G2 point')
  }

  if (pkPoint.is0()) {
    throw new Error('BLS pk is the identity point')
  }

  if (blsParams.sk !== undefined) {
    if (blsParams.sk <= 0n || blsParams.sk >= bls12_381.fields.Fr.ORDER) {
      throw new Error('BLS sk is out of range')
    }
    if (!pkPoint.equals(bls12_381.shortSignatures.getPublicKey(blsParams.sk))) {
      throw new Error('BLS pk and sk do not match')
    }
  }
}

/**
 * Validates a MasterKey
 * @param masterKey - MasterKey to be validated
 * @throws if MasterKey is malformed, of incorrect length or near-zero
 */
export function validateMasterKey(masterKey: MasterKey): void {
  const expectedLength = 66 // 32-byte with '0x' prefix
  validateHexString(masterKey, expectedLength, true)

  const masterKeyBig = hexStringToBigInt(masterKey.hexString)
  if (masterKeyBig <= 2n) {
    throw new Error('Master key value too low')
  }
}

/**
 * Validates an R blinding scalar (must be in [3, Fr.ORDER))
 * @param r - R object to be validated
 * @throws if R is malformed, near-zero, or out of the Fr range
 */
export function validateR(r: R): void {
  validateHexString(r, 66, true) // 32-byte Fr scalar with '0x' prefix

  const rBig = hexStringToBigInt(r.hexString)
  if (rBig <= 2n) {
    throw new Error('R value is too low')
  }
  if (rBig >= bls12_381.fields.Fr.ORDER) {
    throw new Error('R value out of Fr range')
  }
}

/**
 * Pads a BLS12-381 G1 point hex (192 chars) to EIP-2537 format (256 chars)
 * 48-byte coordinates are zero-padded to 64 bytes
 * @param hex - Uncompressed G1 hex
 * @returns padded G1 hex ('0x' + 256 hex chars)
 */
export function nobleG1ToEvm(hex: string): string {
  validateHexString({ hexString: hex }, BLS_G1_HEX_LENGTH, true)
  const raw = hex.slice(2)
  const x = raw.slice(0, 96)
  const y = raw.slice(96, 192)
  return '0x' + x.padStart(128, '0') + y.padStart(128, '0')
}

/**
 * Pads a BLS12-381 G2 point hex (384 chars) to EIP-2537 wire format (512 chars)
 * Fp2 is emitted as (c1, c0); EVM expects (c0, c1), so coordinate order is swapped per Fp2 component.
 * @param hex - Uncompressed G2 hex
 * @returns padded G2 hex ('0x' + 512 hex chars)
 */
export function nobleG2ToEvm(hex: string): string {
  validateHexString({ hexString: hex }, BLS_G2_HEX_LENGTH, true)
  const raw = hex.slice(2)
  // noble: c1_x(48) + c0_x(48) + c1_y(48) + c0_y(48)
  // EVM:   c0_x(64) + c1_x(64) + c0_y(64) + c1_y(64)
  const c1x = raw.slice(0, 96)
  const c0x = raw.slice(96, 192)
  const c1y = raw.slice(192, 288)
  const c0y = raw.slice(288, 384)
  return (
    '0x' +
    c0x.padStart(128, '0') +
    c1x.padStart(128, '0') +
    c0y.padStart(128, '0') +
    c1y.padStart(128, '0')
  )
}

/**
 * Unpads a BLS12-381 G2 point hex from EIP-2537 format (512 chars) to noble uncompressed format (384 chars)
 * EVM expects (c0, c1); Fp2 is emitted as (c1, c0), so coordinate order is swapped per Fp2 component.
 * @param hex - EIP-2537 format G2 hex
 * @returns uncompressed G2 hex ('0x' + 384 hex chars)
 */
export function evmG2ToNoble(hex: string): string {
  validateHexString({ hexString: hex }, 514, true)
  const raw = hex.slice(2)
  // EVM:   c0_x(64) + c1_x(64) + c0_y(64) + c1_y(64)
  // noble: c1_x(48) + c0_x(48) + c1_y(48) + c0_y(48)
  const c0x = raw.slice(0, 128).slice(32)
  const c1x = raw.slice(128, 256).slice(32)
  const c0y = raw.slice(256, 384).slice(32)
  const c1y = raw.slice(384, 512).slice(32)
  return '0x' + c1x + c0x + c1y + c0y
}

/**
 * Checks structure of a BLS blind signature (only (format, on-curve, non-identity).
 * Checks structure only (G1 point in uncompressed hex); Not a signature validity check.
 * @param signature - Signature object to be validated
 * @throws if isBlinded is not a boolean; if Signature is malformed, off-curve, or the identity point
 */
export function validateBlsSignature(signature: BlsSignature): void {
  if (typeof signature.isBlinded !== 'boolean') {
    throw new Error('Signature: isBlinded not set (boolean)')
  }

  validateHexString(signature, BLS_G1_HEX_LENGTH, true)

  let g1Point: ReturnType<typeof bls12_381.curves.G1.fromHex>
  try {
    g1Point = bls12_381.curves.G1.fromHex(signature.hexString.substring(2)) // enforces point is on-curve and rejects small sub-groups
  } catch {
    throw new Error('Signature is not a valid G1 point')
  }
  if (g1Point.is0()) {
    throw new Error('Signature is G1 identity point')
  }
}

/**
 * Validates an encryption key based on the encryption type.
 * @param encryptionKey - The encryption key to be validated.
 * @param encryptionType - The type of encryption (AES or RSA).
 * @throws Will throw an error if the encryption key is invalid for the specified encryption type.
 */
export function validateEncryptionKey(
  encryptionKey: EncryptionKey,
  encryptionType: EncryptionType,
): void {
  if (encryptionType === EncryptionType.AES) {
    validateHexString(encryptionKey, 66, true)
  } else if (encryptionType === EncryptionType.RSA) {
    validateHexString(encryptionKey, 32, true)
  } else {
    throw new Error(`Invalid encryption type: ${encryptionType}`)
  }
}

/**
 * Validates an EIP-191 compliant Ethereum signature.
 * @param ethSignature - The EthSignature to be validated.
 * @throws Will throw an error if the EthSignature object is invalid or of incorrect length.
 */
export function validateEthSignature(ethSignature: EthSignature): void {
  const expectedLength = 132 // Ethereum signature length is 65 bytes, plus 2 for '0x' prefix
  validateHexString(ethSignature, expectedLength)
  try {
    ethers.Signature.from(ethSignature.hexString)
  } catch (error) {
    throw new Error('Invalid Ethereum signature')
  }
}

/**
 * Validates encrypted votes based on the encryption type.
 * @param encryptedVotes - The encrypted votes to be validated.
 * @param encryptionType - The type of encryption used (AES or RSA).
 * @throws Will throw an error if the encrypted votes are invalid.
 */
export function validateEncryptedVotes(
  encryptedVotes: EncryptedVotes,
  encryptionType: EncryptionType,
): void {
  if (encryptionType === EncryptionType.AES) {
    if (!isValidHex(encryptedVotes.hexString, true, false)) {
      throw new Error(`Invalid token format. Token: ${encryptedVotes.hexString}`)
    }
    if (encryptedVotes.hexString.length < 64) {
      throw new Error(
        `Invalid encrypted votes length. Length: ${encryptedVotes.hexString.length}. Expected minimum length: 66`,
      )
    }
  } else if (encryptionType === EncryptionType.RSA) {
    validateHexString(encryptedVotes, RSA_BIT_LENGTH / 4 + 2)
  } else {
    throw new Error(`Invalid encryption type: ${encryptionType}`)
  }
}

/**
 * Validates an array of votes and ensures they can be encrypted.
 * @param votes - The array of votes to be validated.
 * @param encryptionType - The type of encryption to be used (AES or RSA).
 * @param version - Version of the vote format. Defaults to 2
 * @throws Will throw an error if message is empty or too long/short for the encryption type.
 */
export function validateVotes(
  votes: Array<Vote>,
  encryptionType: EncryptionType,
  version: number = 2,
): void {
  const votesString: string = votesToString(votes) // currently same format for version 1 and 2
  const buffer = new TextEncoder().encode(votesString)

  if (encryptionType === EncryptionType.AES) {
    if (buffer.length === 0) {
      throw new Error('AES: Message cannot be empty.')
    }
    if (buffer.length >= 512) {
      throw new Error('AES: Message cannot be longer than 512 bytes.')
    }
  } else {
    // Range check
    const minMessageLength = 2
    // Maximum message length for RSA-OAEP with SHA-256: RSA Key Byte-Size - 2* SHA256 output - 2 OAEP padding overhead
    const maxMessageLength = Math.floor(RSA_BIT_LENGTH / 8) - 2 * (256 / 8) - 2
    if (buffer.length > maxMessageLength) {
      throw new Error(
        `Message too long. Maximum length is ${maxMessageLength} bytes, but got ${buffer.length} bytes.`,
      )
    }
    if (buffer.length < minMessageLength) {
      throw new Error(
        `Message too short. Minimum length is ${minMessageLength} bytes, but got ${buffer.length} bytes.`,
      )
    }
  }
}

/**
 * Validates a voting transaction
 * @param votingTransaction - VotingTransaction to validate
 * @throws if the unblindedSignature is missing or blinded
 */
export function validateVotingTransaction(votingTransaction: VotingTransaction): void {
  if (!votingTransaction.unblindedSignature) {
    throw new Error('Invalid voting transaction: missing required properties')
  }

  validateElectionID(votingTransaction.electionID)
  validateEthAddress(votingTransaction.voterAddress)
  validateEncryptedVotes(votingTransaction.encryptedVoteRSA, EncryptionType.RSA)
  validateEncryptedVotes(votingTransaction.encryptedVoteAES, EncryptionType.AES)
  validateBlsSignature(votingTransaction.unblindedSignature)

  if (votingTransaction.unblindedSignature.isBlinded) {
    throw new Error('Voting transaction must not include a blinded Signature')
  }
}

/**
 * Validates a recasting voting transaction.
 * Ensures that the recasting voting transaction has the required fields.
 * @param {RecastingVotingTransaction} recastingTransaction - The recasting voting transaction to validate.
 * @throws {Error} Will throw an error if any validation check fails.
 */
export function validateRecastingVotingTransaction(
  recastingTransaction: RecastingVotingTransaction,
): void {
  validateElectionID(recastingTransaction.electionID)
  validateEncryptedVotes(recastingTransaction.encryptedVoteRSA, EncryptionType.RSA)
  validateEncryptedVotes(recastingTransaction.encryptedVoteAES, EncryptionType.AES)
  validateEthAddress(recastingTransaction.voterAddress)
}

/**
 * Validates an Ethereum address.
 * @param address - The Ethereum address to be validated.
 * @throws Will throw an error if the address is invalid.
 */
export function validateEthAddress(address: string): void {
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address provided.')
  }
}

/**
 * Normalizes and validates an Ethereum address.
 *
 * @param address - The Ethereum address to process.
 * @returns The normalized address in checksum format.
 * @throws If the address is invalid or fails checksum validation.
 */
export function normalizeEthAddress(address: string): string {
  validateEthAddress(address)
  return ethers.getAddress(address)
}

/**
 * Normalizes a hexadecimal string by removing '0x' prefix, converting to lowercase,
 * and removing leading zeros.
 * @param hexString - The hexadecimal string to normalize.
 * @returns The normalized hexadecimal string without '0x' prefix.
 * @throws Error if the input is not a valid hex string or represents zero.
 */
export function normalizeHexString(hexString: string): string {
  isValidHex(hexString)
  // Remove '0x' prefix if present and convert to lowercase
  const cleanHex = hexString.toLowerCase().replace(/^0x/, '')

  isValidHex(cleanHex, true)

  const bigIntValue = BigInt('0x' + cleanHex)

  let normalized = bigIntValue.toString(16)

  if (normalized === '0') {
    throw new Error('Hexadecimal string represents zero')
  }

  return normalized
}

/**
 * Converts a hexadecimal string to a bigint.
 * @param hexString - The hexadecimal string to convert.
 * @returns The bigint representation of the hexadecimal string.
 */
export function hexStringToBigInt(hexString: string): bigint {
  // Ensure the hexString is 0x prefixed
  if (!hexString.startsWith('0x')) {
    hexString = '0x' + hexString
  }

  // Convert the hex string to a bigint
  const messageBigInt = BigInt(hexString)
  return messageBigInt
}

/**
 * Validates that a string is valid Base64.
 * @throws if the string is not valid Base64
 */
export function validateBase64(base64String: string): void {
  let dummy: string
  try {
    dummy = ethers.encodeBase64(ethers.decodeBase64(base64String))
  } catch {
    throw new Error('Invalid base64 string')
  }
  if (dummy !== base64String) {
    throw new Error('Invalid base64 string')
  }
}

/**
 * Converts a Base64-encoded string to a hexadecimal string with "0x" prefix.
 * This function handles the conversion Token, R and Signature types.
 *
 * @param base64String - The Base64 string to be converted.
 * @returns A '0x' prefixed hexadecimal string representation of the Base64 input.
 */
export function base64ToHexString(base64String: string): string {
  return ethers.hexlify(ethers.decodeBase64(base64String))
}

/**
 * Validates the integrity and format of ElectionCredentials.
 * @param credentials - The ElectionCredentials object to be validated.
 * @throws Will throw an error if the credentials object is invalid.
 */
export function validateCredentials(credentials: ElectionCredentials): void {
  validateBlsSignature(credentials.unblindedSignature)
  validateElectionID(credentials.electionID)

  const voterWalletPrivKey = credentials.voterWallet.privateKey
  validateHexString({ hexString: voterWalletPrivKey }, 66)
  validateEthAddress(credentials.voterWallet.address)

  validateEncryptionKey(credentials.encryptionKey, EncryptionType.AES)

  if (credentials.unblindedSignature.isBlinded) {
    throw new Error('Signature must be unblinded.')
  }
}

/**
 * Signs a blinded token with the private scalar
 * @param token - Blinded token (G1 point) to be signed
 * @param blsParams - BLS parameters with sk
 * @returns Blinded BLS signature (G1 point)
 * @throws if the token is not blinded; if sk is missing; if any input is invalid
 */
export function signToken(token: Token, blsParams: BlsParams): BlsSignature {
  if (!token.isBlinded) {
    throw new Error('Only blinded Tokens can be signed')
  }
  if (blsParams.sk === undefined) {
    throw new Error('BLS sk is missing')
  }
  validateBlsParams(blsParams)
  validateToken(token)

  const M_prime = bls12_381.curves.G1.fromHex(token.hexString.substring(2))
  const S_prime = bls12_381.shortSignatures.sign(M_prime, blsParams.sk)

  const blindedSignature = { hexString: '0x' + S_prime.toHex(false), isBlinded: true }
  validateBlsSignature(blindedSignature)

  return blindedSignature
}

/**
 * Returns the bit length of a BigInt value.
 * @param bigIntValue - The BigInt value to get the bit length of.
 * @returns The bit length of the BigInt value.
 */
export function getBitLength(bigIntValue: BigInt) {
  return bigIntValue.toString(2).length
}

/**
 * Returns the appropriate SubtleCrypto instance based on the environment (browser or Node.js).
 * @returns A SubtleCrypto instance.
 */
export function getSubtleCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }
  return globalThis.crypto.subtle
}

/**
 * Helper function to convert an array of votes to string.
 * @param {Array<Vote>} votes - Array of votes to convert.
 * @returns {string} String representation of votes.
 * @throws {Error} if any vote is not a valid VoteOption.
 */
export function votesToString(votes: Array<Vote>): string {
  return votes
    .map(vote => {
      if (!Object.values(VoteOption).includes(vote.value)) {
        throw new Error(`Invalid vote option: ${vote.value}`)
      }
      return vote.value.toString()
    })
    .join(',')
}

/**
 * Helper function to convert a string to an array of votes.
 * @param {string} votesString - String representation of votes.
 * @param {number} version - Version of the vote format (1 = legacy with empty vote support). Default is 2.
 * @param {number} expectedVoteCount - Expected number of votes. For version 1, pads short arrays with Abstain.
 * @returns {Array<Vote>} Array of votes.
 * @throws {Error} if any character in the votesString is not a valid VoteOption (version 2+).
 */
export function stringToVotes(
  votesString: string,
  version: number = 2,
  expectedVoteCount?: number,
): Array<Vote> {
  if (!votesString || votesString.trim() === '') {
    throw new Error('votesString cannot be empty')
  }

  // Version 1 needs expectedVoteCount for padding
  if (version === 1 && expectedVoteCount === undefined) {
    throw new Error('expectedVoteCount is required for version 1')
  }

  const votes = votesString.split(',').map(vote => {
    // Version 1: Legacy format -> map empty strings to Abstain
    if (version === 1 && vote.trim() === '') {
      return { value: VoteOption.Abstain }
    }

    const voteValue = parseInt(vote, 10)
    if (isNaN(voteValue) || vote.trim() !== voteValue.toString()) {
      // catching 1.5, 1abc etc.
      throw new Error(`Invalid vote format: ${vote}`)
    }

    if (!Object.values(VoteOption).includes(voteValue)) {
      throw new Error(`Invalid vote option encountered: ${voteValue}`)
    }
    return { value: voteValue as VoteOption }
  })

  // Version 1: Pad votes with Abstain
  if (version === 1 && votes.length < expectedVoteCount!) {
    while (votes.length < expectedVoteCount!) {
      votes.push({ value: VoteOption.Abstain })
    }
  }

  if (expectedVoteCount && votes.length !== expectedVoteCount) {
    throw new Error(`Unexpected vote count. Got ${votes.length}, expected ${expectedVoteCount}`)
  }
  return votes
}

/**
 * Converts a hex string into a Uint8Array. Adds '0x'-prefix if missing.
 * @param {string} hexString -  hex string to convert
 * @returns {Uint8Array} byte array representing binary data
 */
export function hexToBuffer(hexString: string): Uint8Array {
  if (!hexString.startsWith('0x')) {
    hexString = '0x' + hexString
  }
  return ethers.getBytes(hexString)
}
