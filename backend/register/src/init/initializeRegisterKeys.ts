import { RegisterKeyService } from '../services/registerKeyService'
import { isValidHex } from 'votingsystem'

// Create register key array from .env variables REGISTER_ELECTION_[0-99]_*
const registerKeys = Array.from({ length: 100 }, (_, i) => i)
  .filter(id => process.env[`REGISTER_ELECTION_${id}_N`])
  .map(id => ({
    electionId: id,
    N: process.env[`REGISTER_ELECTION_${id}_N`]!,
    D: process.env[`REGISTER_ELECTION_${id}_D`]!,
    E: process.env[`REGISTER_ELECTION_${id}_E`]!,
    NbitLength: parseInt(process.env[`REGISTER_ELECTION_${id}_N_LENGTH`]!, 10),
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

      if (!isValidHex(key.N, false, false)) {
        throw new Error(`Invalid hex format for N: ${key.N}`)
      }
      if (!isValidHex(key.D, false, false)) {
        throw new Error(`Invalid hex format for D: ${key.D}`)
      }
      if (isValidHex(key.E)) {
        throw new Error(`E must be a decimal number, not hex: ${key.E}`)
      }

      // Sanity check: N and D must not be equal
      if (key.N.toLowerCase() === key.D.toLowerCase()) {
        throw new Error(`N and D cannot be equal for election ${key.electionId}`)
      }

      const rsaParams = {
        N: BigInt(key.N),
        D: BigInt(key.D),
        e: BigInt(key.E),
        NbitLength: key.NbitLength,
      }

      await RegisterKeyService.storeKeys(key.electionId, rsaParams)

      console.log(`Successfully initialized key for election id ${key.electionId}:
                N: ${maskKey(key.N)}
                D: ${maskKey(key.D)}
                E: ${maskKey(key.E)}
                Length: ${key.NbitLength} bits`)
    }
  } catch (error) {
    console.error('Error initializing register key:', error)
    throw error
  }
}
