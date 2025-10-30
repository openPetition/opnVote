import dotenv from 'dotenv'
dotenv.config()

import { decryptVotes, EncryptedVotes, EncryptionKey, EncryptionType } from 'votingsystem'
import { logger } from './utils/logger'
import { getEnvVar } from './utils/utils'
const ELECTION_PRIVATE_KEY_FROM_ENV = getEnvVar<string>('ELECTION_PRIVATE_KEY', 'string')

async function debugDecryption() {
  const ENCRYPTED_VOTE = ''
  const PRIVATE_KEY = ELECTION_PRIVATE_KEY_FROM_ENV!

  const encryptedVotes: EncryptedVotes = {
    hexString: ENCRYPTED_VOTE,
    encryptionType: EncryptionType.RSA,
  }

  const privateKey: EncryptionKey = {
    hexString: PRIVATE_KEY,
    encryptionType: EncryptionType.RSA,
  }

  try {
    const decryptedVotes = await decryptVotes(encryptedVotes, privateKey, EncryptionType.RSA)
    logger.info('✓ Success:')
    console.log(decryptedVotes)
  } catch (error) {
    logger.error('✗ Failed:', error)
  }
}

debugDecryption()
