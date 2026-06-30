import { RegisterKeyService } from '../services/registerKeyService'
import { validateBlsParams } from 'votingsystem'

// Create register key array from .env variables REGISTER_ELECTION_[0-99]_PK and REGISTER_ELECTION_[0-99]_SK
const registerKeys = Array.from({ length: 100 }, (_, i) => i)
  .filter(id => process.env[`REGISTER_ELECTION_${id}_PK`])
  .map(id => ({
    electionId: id,
    pk: process.env[`REGISTER_ELECTION_${id}_PK`]!,
    sk: process.env[`REGISTER_ELECTION_${id}_SK`]!,
  }))

function maskKey(key: string): string {
  return `${key.slice(0, 4)}...${key.slice(-2)}`
}

/**
 * Initializes register keys from .env
 * WARNING: This function is intended only for manual key insertion.
 * For production use, use admin routes to manage register keys.
 * @throws {Error} If keys already exist for the specified election id
 */
export async function initializeRegisterKeys() {
  if (registerKeys.length > 0) {
    console.warn(`Initializing ${registerKeys.length} register keys from environment variables.`)
  }

  try {
    for (const key of registerKeys) {
      const existingKey = await RegisterKeyService.getKeysByElectionId(key.electionId)
      if (existingKey) {
        console.error(`Warning: Register key already exist in db for election ${key.electionId}.`)
        console.info(`Info: Register key initialization skipped for election ${key.electionId}`)
        continue
      }

      if (!key.sk) {
        throw new Error(`Missing REGISTER_ELECTION_${key.electionId}_SK`)
      }

      const blsParams = { pk: key.pk, sk: BigInt(key.sk) }
      validateBlsParams(blsParams)

      await RegisterKeyService.storeKeys(key.electionId, blsParams)

      console.log(`Successfully initialized key for election id ${key.electionId}:
                pk: ${maskKey(key.pk)}`)
    }
  } catch (error) {
    console.error('Error initializing register key:', error)
    throw error
  }
}
