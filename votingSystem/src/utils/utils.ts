import Hex from 'crypto-js/enc-hex'
import {
  ElectionCredentials,
  EncryptedVotes,
  EncryptionKey,
  EncryptionType,
  EthSignature,
  R,
  RSAParams,
  RecastingVotingTransaction,
  Signature,
  Token,
  Vote,
  VoteOption,
  VotingTransaction,
} from '../types/types'
import Base64 from 'crypto-js/enc-base64'
import { ethers, verifyTypedData } from 'ethers'
import * as crypto from 'crypto'
import { RSA_BIT_LENGTH, PREFIX_BLINDED_TOKEN, PREFIX_UNBLINDED_TOKEN } from './constants'
import { modPow } from 'bigint-crypto-utils'
import { SignatureData } from '@gelatonetwork/relay-sdk'
import { gelatoRelayDomain, gelatoRelayTypes } from '../config'

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
  const wordArray = Hex.parse(hexStringObject.hexString.substring(2))
  return Base64.stringify(wordArray)
}

/**
 * Validates the provided token based on its properties.
 *
 * @param {Token} token - The token to validate.
 * @param {boolean} [validatePrefix=true] - Whether to validate the token's prefix. Default is true.
 * @throws {Error} If the token is invalid or its properties are inconsistent.
 */
export function validateToken(token: Token, validatePrefix: boolean = true): void {
  if (token.isBlinded && token.isMaster) {
    throw new Error('Master token must not be blinded')
  }

  let expectedLength = 66 // Default length for unblinded tokens (SHA-256 Output)
  if (token.isBlinded) {
    expectedLength = RSA_BIT_LENGTH / 4 + 2 // Adjust length for blinded tokens: Convert bit length to hex length and add 2 for '0x' prefix.
  }

  validateHexString(token, expectedLength, true)

  // Check if tokenBig is within range
  const tokenBig = hexStringToBigInt(token.hexString)
  if (tokenBig <= 2n) {
    throw new Error('Token value is too low')
  }

  const upperBound = (1n << BigInt(RSA_BIT_LENGTH)) - 1n
  if (tokenBig >= upperBound) {
    throw new Error('Token value is too high')
  }

  // Prefix is only for election Token (blinded & unblided) checked
  if (!token.isMaster && validatePrefix) {
    if (
      token.isBlinded &&
      !token.hexString.toLowerCase().startsWith(PREFIX_BLINDED_TOKEN.toLowerCase())
    ) {
      throw new Error(`Blinded Tokens must be ${PREFIX_BLINDED_TOKEN.toLowerCase()} prefixed`)
    } else if (
      !token.isBlinded &&
      !token.hexString.toLowerCase().startsWith(PREFIX_UNBLINDED_TOKEN.toLowerCase())
    ) {
      throw new Error(`Unblinded Tokens must be ${PREFIX_UNBLINDED_TOKEN.toLowerCase()} prefixed`)
    }
  }
}

/**
 * Validates RSA parameters to ensure they are secure.
 * @param rsaParams - The RSAParams object to be validated.
 * @throws Will throw an error if the RSA parameters are insecure.
 */
export function validateRSAParams(rsaParams: RSAParams): void {
  // Check if the bit length is less than 2048 bits
  if (rsaParams.NbitLength < RSA_BIT_LENGTH) {
    throw new Error('RSA bit length must be at least 2048 bits')
  }

  // Check if 'e' is within the typical range
  if (rsaParams.e !== undefined && (rsaParams.e < 3n || rsaParams.e % 2n === 0n)) {
    throw new Error("RSA exponent 'e' must be an odd number greater than 2")
  }

  // Check if NbitLength matches the real bit length of N
  const actualBitLength = getBitLength(rsaParams.N)
  if (rsaParams.NbitLength !== actualBitLength) {
    throw new Error('NbitLength does not match the actual bit length of N')
  }

  if (rsaParams.D !== undefined) {
    // D should be at least half the bit length of N
    const minDValue = 2n ** BigInt(rsaParams.NbitLength / 2)
    if (rsaParams.D < minDValue) {
      throw new Error("RSA private exponent 'D' is too small")
    }
  }
}

/**
 * Validates an R object.
 * @param r - The R object to be validated.
 * @throws Will throw an error if the R object is invalid or of incorrect length.
 */
export function validateR(r: R): void {
  const expectedLength = 66 // Default length sha 256-output
  validateHexString(r, expectedLength, true)

  const rBig = hexStringToBigInt(r.hexString)

  // Check lower bound
  if (rBig <= 2n) {
    throw new Error('R value is too low')
  }
}

/**
 * Validates an Signature.
 * @param signature - The Signature object to be validated.
 * @throws Will throw an error if the Signature object is invalid or of incorrect length.
 */
export function validateSignature(signature: Signature): void {
  const expectedLength = RSA_BIT_LENGTH / 4 + 2 // length for signature: Convert bit length to hex length and add 2 for '0x' prefix.
  validateHexString(signature, expectedLength, true)

  // Check if tokenBig is within range
  const signatureBig = hexStringToBigInt(signature.hexString)
  if (signatureBig <= 2n) {
    throw new Error('Signature value is too low')
  }

  const upperBound = (1n << BigInt(RSA_BIT_LENGTH)) - 1n
  if (signatureBig >= upperBound) {
    throw new Error('Signature value is too high')
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
 * Validates a voting transaction.
 * Ensures that the voting transaction does not include a master token, a blinded token, or a blinded signature.
 * @param {VotingTransaction} votingTransaction - The voting transaction to validate.
 * @throws {Error} Will throw an error if any validation check fails.
 */
export function validateVotingTransaction(votingTransaction: VotingTransaction): void {
  if (!votingTransaction.unblindedElectionToken || !votingTransaction.unblindedSignature) {
    throw new Error('Invalid voting transaction: missing required properties')
  }

  validateElectionID(votingTransaction.electionID)
  validateEthAddress(votingTransaction.voterAddress)
  validateEncryptedVotes(votingTransaction.encryptedVoteRSA, EncryptionType.RSA)
  validateEncryptedVotes(votingTransaction.encryptedVoteAES, EncryptionType.AES)
  validateToken(votingTransaction.unblindedElectionToken)
  validateSignature(votingTransaction.unblindedSignature)

  if (votingTransaction.unblindedElectionToken.isMaster) {
    throw new Error('Voting transaction must not include a Master Token.')
  }
  if (votingTransaction.unblindedElectionToken.isBlinded) {
    throw new Error('Voting transaction must not include a blinded Token')
  }

  if (votingTransaction.unblindedSignature.isBlinded) {
    throw new Error('Voting transaction must not include a blinded Signature')
  }

  if (votingTransaction.svsSignature) {
    validateEthSignature(votingTransaction.svsSignature)
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
 * Converts a Base64-encoded string to a hexadecimal string with "0x" prefix.
 * This function handles the conversion Token, R and Signature types.
 *
 * @param base64String - The Base64 string to be converted.
 * @returns A '0x' prefixed hexadecimal string representation of the Base64 input.
 */
export function base64ToHexString(base64String: string): string {
  const wordArray = Base64.parse(base64String)
  const hexStringWithPrefix = '0x' + Hex.stringify(wordArray)
  return hexStringWithPrefix
}

/**
 * Validates the integrity and format of ElectionCredentials.
 * @param credentials - The ElectionCredentials object to be validated.
 * @throws Will throw an error if the credentials object is invalid.
 */
export function validateCredentials(credentials: ElectionCredentials): void {
  validateSignature(credentials.unblindedSignature)
  validateToken(credentials.unblindedElectionToken)
  validateElectionID(credentials.electionID)

  const voterWalletPrivKey = credentials.voterWallet.privateKey
  validateHexString({ hexString: voterWalletPrivKey }, 66)
  validateEthAddress(credentials.voterWallet.address)

  validateEncryptionKey(credentials.encryptionKey, EncryptionType.AES)

  if (credentials.unblindedSignature.isBlinded) {
    throw new Error('Signature must be unblinded.')
  }
  if (credentials.unblindedElectionToken.isBlinded) {
    throw new Error('Election token must be unblinded.')
  }
  if (credentials.unblindedElectionToken.isMaster) {
    throw new Error('Election token must not be a master token.')
  }
}

/**
 * Signs a blinded token using the provided RSA parameters.
 *
 * @param {Token} token - The blinded token to be signed.
 * @param {RSAParams} rsaParams - The RSA parameters, including the private exponent.
 * @returns {Signature} The signature of the blinded token.
 * @throws {Error} If the token is not blinded, if it is a master token, if the private exponent is missing,
 *                 if the token is invalid, if the RSA parameters are invalid, or if the token is out of the valid range.
 */
export function signToken(token: Token, rsaParams: RSAParams): Signature {
  if (!token.isBlinded) {
    throw new Error('Only blinded Tokens shall be signed')
  }
  if (token.isMaster) {
    throw new Error('Master Tokens shall not be signed')
  }
  if (!rsaParams.D) {
    throw new Error('Private exponent is missing')
  }
  validateRSAParams(rsaParams)
  validateToken(token)

  const tokenBig = hexStringToBigInt(token.hexString)
  if (tokenBig <= 2n || tokenBig >= rsaParams.N - 1n) {
    throw new Error('Token is out of valid range')
  }

  const signatureBig = modPow(tokenBig, rsaParams.D, rsaParams.N) // tokenBig ** rsaParams.D % rsaParams.N;

  // Calculate  hex length from N if not provided
  const signatureHex = '0x' + signatureBig.toString(16).padStart(rsaParams.NbitLength / 4, '0')
  const blindedSignature = { hexString: signatureHex, isBlinded: true }
  validateSignature(blindedSignature)

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
export function getSubtleCrypto(): SubtleCrypto | crypto.webcrypto.SubtleCrypto {
  if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
    return window.crypto.subtle
  } else {
    return crypto.webcrypto.subtle
  }
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
  // Version 1 needs expectedVoteCount for padding
  if (version === 1 && expectedVoteCount === undefined) {
    throw new Error('expectedVoteCount is required for version 1')
  }

  const votes = votesString.split(',').map(vote => {
    // Version 1: Legacy format -> map empty strings to Abstain
    if (version === 1 && vote.trim() === '') {
      return { value: VoteOption.Abstain }
    }

    const voteValue = parseInt(vote)

    if (version === 1 && isNaN(voteValue)) {
      return { value: VoteOption.Abstain }
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

  return votes
}

/**
 * Converts a hex string into a Buffer. Removes '0x'-prefix is present
 * @param {string} hexString -  hex string to convert
 * @returns {Buffer} Buffer representing binary data
 */
export function hexToBuffer(hexString: string): Buffer {
  if (hexString.startsWith('0x')) {
    hexString = hexString.substring(2)
  }
  return Buffer.from(hexString, 'hex')
}

/**
 * Validates a Gelato ERC2771 signature for sponsored calls.
 * @param signatureData - The signature data containing the struct and signature.
 * @throws Will throw an error if the signature data is invalid.
 */
export function validateGelatoSignature(signatureData: SignatureData) {
  try {
    const signer = signatureData.struct.user
    const signature: EthSignature = { hexString: signatureData.signature }
    validateEthAddress(signer)
    validateEthSignature(signature)

    const recoveredAddress = verifyTypedData(
      gelatoRelayDomain,
      gelatoRelayTypes,
      signatureData.struct,
      signatureData.signature,
    )

    const isValid = recoveredAddress.toLowerCase() === signer.toLowerCase()

    if (!isValid) {
      throw new Error(`Signature signer mismatch. Expected: ${signer}, got: ${recoveredAddress}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Gelato signature validation failed: ${error.message}`)
    }
    throw new Error('Gelato signature validation failed with unknown error')
  }
}
