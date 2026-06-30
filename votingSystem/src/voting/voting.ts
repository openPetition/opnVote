import { ethers } from 'ethers'
import {
  ElectionCredentials,
  EncryptedVotes,
  EncryptionKey,
  EncryptionType,
  RecastingVotingTransaction,
  Vote,
  VotingTransaction,
} from '../types/types'
import { RSA_BIT_LENGTH } from '../utils/constants'
import {
  getSubtleCrypto,
  hexToBuffer,
  stringToVotes,
  validateCredentials,
  validateEncryptedVotes,
  validateEncryptionKey,
  validateEthAddress,
  validateRecastingVotingTransaction,
  validateBlsSignature,
  validateVotes,
  validateVotingTransaction,
  votesToString,
} from '../utils/utils'

/**
 * Creates a voting transaction
 * @param voterCredentials - Credentials of the voter
 * @param encryptedVotesRSA - RSA-encrypted votes
 * @param encryptedVotesAES - AES-encrypted votes
 * @returns VotingTransaction
 * @throws if any validation fails
 */
export function createVotingTransaction(
  voterCredentials: ElectionCredentials,
  encryptedVotesRSA: EncryptedVotes,
  encryptedVotesAES: EncryptedVotes,
): VotingTransaction {
  validateEncryptedVotes(encryptedVotesRSA, EncryptionType.RSA)
  validateEncryptedVotes(encryptedVotesAES, EncryptionType.AES)

  validateBlsSignature(voterCredentials.unblindedSignature)
  validateEthAddress(voterCredentials.voterWallet.address)

  if (voterCredentials.unblindedSignature.isBlinded) {
    throw new Error('Voting transaction must not include a blinded Signature')
  }

  const votingTransaction: VotingTransaction = {
    electionID: voterCredentials.electionID,
    voterAddress: voterCredentials.voterWallet.address,
    encryptedVoteRSA: encryptedVotesRSA,
    encryptedVoteAES: encryptedVotesAES,
    unblindedSignature: voterCredentials.unblindedSignature,
  }

  validateVotingTransaction(votingTransaction)

  return votingTransaction
}

/**
 * Creates a recasting voting transaction.
 * @param {ElectionCredentials} voterCredentials - Credentials of the voter
 * @param {EncryptedVotes} encryptedVotesRSA - Encrypted votes RSA to be included in the recasting voting transaction
 * @param {EncryptedVotes} encryptedVotesAES - Encrypted votes AES to be included in the recasting voting transaction
 * @returns {RecastingVotingTransaction} Recasting voting transaction
 * @throws {Error} If any validation (ElectionID, EncryptedVotes, EthAddress) fails
 */
export function createVoteRecastTransaction(
  voterCredentials: ElectionCredentials,
  encryptedVotesRSA: EncryptedVotes,
  encryptedVotesAES: EncryptedVotes,
): RecastingVotingTransaction {
  validateCredentials(voterCredentials)
  validateEncryptedVotes(encryptedVotesRSA, EncryptionType.RSA)
  validateEncryptedVotes(encryptedVotesAES, EncryptionType.AES)

  const recastingVotingTransaction: RecastingVotingTransaction = {
    electionID: voterCredentials.electionID,
    voterAddress: voterCredentials.voterWallet.address,
    encryptedVoteRSA: encryptedVotesRSA,
    encryptedVoteAES: encryptedVotesAES,
  }

  validateRecastingVotingTransaction(recastingVotingTransaction)

  return recastingVotingTransaction
}

/**
 * Encrypts an array of votes using the specified encryption type.
 * @param {Array<Vote>} votes - Array of votes to encrypt
 * @param {EncryptionKey} encryptionKey - Encryption key
 * @param {EncryptionType} encryptionType - Encryption type to use (AES or RSA)
 * @param {number} version - Version of the vote format (1 = legacy). Defaults to 2
 * @returns {EncryptedVotes} Encrypted votes
 */
export async function encryptVotes(
  votes: Array<Vote>,
  encryptionKey: EncryptionKey,
  encryptionType: EncryptionType,
  version: number = 2,
): Promise<EncryptedVotes> {
  if (encryptionKey.encryptionType !== encryptionType) {
    throw new Error(
      'Encryption type mismatch. Encryption type: ' +
        encryptionKey.encryptionType +
        ', Encryption type: ' +
        encryptionType,
    )
  }

  if (encryptionKey.encryptionType === EncryptionType.AES) {
    return await encryptVotesAES(votes, encryptionKey, version)
  } else if (encryptionKey.encryptionType === EncryptionType.RSA) {
    return await encryptVotesRSA(votes, encryptionKey, version)
  } else {
    throw new Error('Invalid encryption type. Encryption type: ' + encryptionKey.encryptionType)
  }
}

/**
 * Decrypts an array of votes using the specified encryption type.
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes to decrypt
 * @param {EncryptionKey} encryptionKey - Encryption key
 * @param {EncryptionType} encryptionType - Encryption type to use (AES or RSA)
 * @param {number} version - Version of the vote format (1 = legacy). Defaults to 2
 * @param {number} expectedVoteCount - Expected number of votes. version 1: pads arrays with Abstain
 * @returns {Array<Vote>} An array of votes
 */
export async function decryptVotes(
  encryptedVotes: EncryptedVotes,
  encryptionKey: EncryptionKey,
  encryptionType: EncryptionType,
  version: number = 2,
  expectedVoteCount?: number,
): Promise<Array<Vote>> {
  if (encryptionKey.encryptionType !== encryptionType) {
    throw new Error(
      'Encryption type mismatch. Encryption type: ' +
        encryptionKey.encryptionType +
        ', Encryption type: ' +
        encryptionType,
    )
  }

  if (encryptionKey.encryptionType === EncryptionType.AES) {
    const votes = await decryptVotesAES(encryptedVotes, encryptionKey, version, expectedVoteCount)
    validateVotes(votes, encryptionType, version)
    return votes
  } else if (encryptionKey.encryptionType === EncryptionType.RSA) {
    const votes = await decryptVotesRSA(encryptedVotes, encryptionKey, version, expectedVoteCount)
    validateVotes(votes, encryptionType, version)
    return votes
  } else {
    throw new Error('Invalid encryption type. Encryption type: ' + encryptionKey.encryptionType)
  }
}

/**
 * Encrypts an array of votes using AES-GCM.
 * @param {Array<Vote>} votes - Array of votes to encrypt
 * @param {EncryptionKey} encryptionKey - Encryption key in DER format
 * @param {number} version - Version of the vote format. Defaults to 2
 * @returns {EncryptedVotes} Encrypted votes
 */
async function encryptVotesAES(
  votes: Array<Vote>,
  encryptionKey: EncryptionKey,
  version: number = 2,
): Promise<EncryptedVotes> {
  try {
    validateEncryptionKey(encryptionKey, EncryptionType.AES)
    validateVotes(votes, EncryptionType.AES, version)

    const subtle = getSubtleCrypto()

    const keyBuffer = ethers.getBytes(encryptionKey.hexString)
    const iv = ethers.randomBytes(12) // 12 bytes (96 bits)
    const encoder = new TextEncoder()
    const voteBytes = encoder.encode(votesToString(votes))

    const cryptoKey = await subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    )
    const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, voteBytes)
    const encryptedHex = ethers.concat([iv, new Uint8Array(encrypted)])

    return { hexString: encryptedHex, encryptionType: EncryptionType.AES }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('Failed to encrypt votes: ' + error.message)
    } else {
      throw new Error('Failed to encrypt votes due to an unknown error. Error: ' + error)
    }
  }
}

/**
 * Decrypts an array of votes using AES-GCM.
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes
 * @param {EncryptionKey} encryptionKey - Encryption key in DER format
 * @param {number} version - Version of the vote format (1 = legacy). Defaults to 2
 * @param {number} expectedVoteCount - Expected number of votes. Version 1: pads arrays with Abstain
 * @returns {Array<Vote>} An array of votes
 */
async function decryptVotesAES(
  encryptedVotes: EncryptedVotes,
  encryptionKey: EncryptionKey,
  version: number = 2,
  expectedVoteCount?: number,
): Promise<Array<Vote>> {
  try {
    validateEncryptionKey(encryptionKey, EncryptionType.AES)
    validateEncryptedVotes(encryptedVotes, EncryptionType.AES)
    const subtle = getSubtleCrypto()

    const keyBuffer = ethers.getBytes(encryptionKey.hexString)
    const encryptedBuffer = ethers.getBytes(encryptedVotes.hexString)

    const iv = encryptedBuffer.subarray(0, 12)
    const ciphertext = encryptedBuffer.subarray(12)

    const cryptoKey = await subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )

    const decryptedBytes = await subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)

    const decryptedString = new TextDecoder().decode(decryptedBytes)

    const votes: Array<Vote> = stringToVotes(decryptedString, version, expectedVoteCount)
    validateVotes(votes, EncryptionType.AES, version)
    return votes
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('Failed to decrypt votes: ' + error.message)
    } else {
      throw new Error('Failed to decrypt votes due to an unknown error. Error: ' + error)
    }
  }
}

/**
 * Encrypts an array of votes using RSA-OAEP with SHA-256 as hash function.
 * @param {Array<Vote>} votes - Array of votes to encrypt
 * @param {EncryptionKey} encryptionKey - Encryption key in DER format
 * @param {number} version - Version of the vote format. Defaults to 2
 * @returns {EncryptedVotes} Encrypted votes
 * @throws {Error} if no votes are provided or if any error occurs during the encryption process
 */
async function encryptVotesRSA(
  votes: Array<Vote>,
  encryptionKey: EncryptionKey,
  version: number = 2,
): Promise<EncryptedVotes> {
  if (votes.length === 0) {
    throw new Error('Encryption error: No votes provided.')
  }
  if (encryptionKey.encryptionType !== EncryptionType.RSA) {
    throw new Error(
      'Encryption type mismatch. Encryption type: ' +
        encryptionKey.encryptionType +
        ', expected: ' +
        EncryptionType.RSA,
    )
  }

  try {
    validateVotes(votes, EncryptionType.RSA, version)
    const subtle = getSubtleCrypto()
    const publicKeyBuffer = hexToBuffer(encryptionKey.hexString)
    const publicKey = await subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['encrypt'],
    )

    // Validate Key size
    const keyDetails = await subtle.exportKey('jwk', publicKey)
    if (keyDetails.n) {
      const keySize = (keyDetails.n.length * 6) / 8 // Approximate bit length
      const expectedKeySize = RSA_BIT_LENGTH / 8
      if (Math.abs(keySize - expectedKeySize) > 1) {
        throw new Error(
          `Invalid key size. Expected around ${RSA_BIT_LENGTH} bits, but got approximately ${Math.round(
            keySize * 8,
          )} bits.`,
        )
      }
    } else {
      throw new Error('Unable to determine key size.')
    }

    const votesString: string = votesToString(votes)
    const buffer = new TextEncoder().encode(votesString)
    const encrypted = await subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      buffer,
    )
    const encryptedVotes: EncryptedVotes = {
      hexString: ethers.hexlify(new Uint8Array(encrypted)),
      encryptionType: EncryptionType.RSA,
    }
    validateEncryptedVotes(encryptedVotes, EncryptionType.RSA)

    return encryptedVotes
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('Failed to encrypt votes: ' + error.message)
    } else {
      throw new Error('Failed to encrypt votes due to an unknown error. Error: ' + error)
    }
  }
}

/**
 * Decrypts a string of encrypted votes using RSA-OAEP with SHA-256.
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes
 * @param {EncryptionKey} encryptionKey - Encryption key in DER format
 * @param {number} version - Version of the vote format (1 = legacy). Defaults to 2.
 * @param {number} expectedVoteCount - Expected number of votes. version 1: pads arrays with Abstain
 * @returns {Array<Vote>} An array of votes
 * @throws {Error} If no valid encrypted data is provided or if any error occurs during the decryption process.
 */
async function decryptVotesRSA(
  encryptedVotes: EncryptedVotes,
  encryptionKey: EncryptionKey,
  version: number = 2,
  expectedVoteCount?: number,
): Promise<Array<Vote>> {
  if (encryptionKey.encryptionType !== EncryptionType.RSA) {
    throw new Error(
      'Encryption type mismatch. Encryption type: ' +
        encryptionKey.encryptionType +
        ', expected: ' +
        EncryptionType.RSA,
    )
  }

  if (
    !encryptedVotes.hexString ||
    encryptedVotes.hexString.length <= 2 ||
    !encryptedVotes.hexString.startsWith('0x')
  ) {
    throw new Error('Decryption error: No valid encrypted data provided.')
  }
  validateEncryptedVotes(encryptedVotes, EncryptionType.RSA)

  try {
    const subtle = getSubtleCrypto()
    const privateKeyBuffer = hexToBuffer(encryptionKey.hexString)
    const privateKey = await subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['decrypt'],
    )
    const encryptedBuf = hexToBuffer(encryptedVotes.hexString)
    const decrypted = await subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedBuf,
    )
    const votesString = new TextDecoder().decode(decrypted)
    const votes = stringToVotes(votesString, version, expectedVoteCount)
    validateVotes(votes, EncryptionType.RSA, version)

    return votes
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('Failed to decrypt votes: ' + error.message)
    } else {
      throw new Error('Failed to decrypt votes due to an unknown error. Error: ' + error)
    }
  }
}
