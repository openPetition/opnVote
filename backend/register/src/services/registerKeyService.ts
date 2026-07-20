import { RegisterKey } from '../models/RegisterKey'
import { BlsParams, validateBlsParams } from 'votingsystem'

export class RegisterKeyService {
  /**
   * @throws {Error} If the BLS parameters are invalid
   */
  static async getKeysByElectionId(electionId: number): Promise<BlsParams | null> {
    const keyPair: RegisterKey | null = await RegisterKey.findOne({ where: { electionId } })

    if (!keyPair) {
      return null
    }

    const blsParams: BlsParams = {
      pk: keyPair.pk,
      sk: BigInt(keyPair.sk),
    }

    validateBlsParams(blsParams)

    return blsParams
  }

  static async storeKeys(electionId: number, blsParams: BlsParams): Promise<RegisterKey> {
    if (blsParams.sk === undefined) {
      throw new Error('Invalid BLS params: sk required')
    }

    validateBlsParams(blsParams)

    const existingKeys = await RegisterKey.findOne({ where: { electionId } })
    if (existingKeys) {
      throw new Error(`Key already exist for election ${electionId}`)
    }

    const keyPair = new RegisterKey()
    keyPair.electionId = electionId
    keyPair.pk = blsParams.pk
    keyPair.sk = blsParams.sk.toString()

    return await keyPair.save()
  }
}
