import { dataSource } from '../database'
import { BlindedSignature } from '../models/BlindedSignature'

type OnchainStatus = 'pending' | 'submitted' | 'confirmed' | 'failed'

/**
 * Service for managing locally stored blinded signatures (fetching, updating, etc)
 */
export class BlindedSignatureService {
  /**
   * Get pending registrations (currently not confirmed on-chain)
   * @returns Pending registrations
   */
  static async getPendingRegistrations(): Promise<BlindedSignature[]> {
    const repository = dataSource.getRepository(BlindedSignature)
    return repository.find({
      where: {
        onchainStatus: 'pending',
      },
    })
  }

  /**
   * Update the status of a registration
   * @param id - The Id of the registration
   * @param status - The on-chain status of the registration
   * @param txHash - The on-chain transaction hash of the registration
   * @param batchId - The batch Id of the registration
   */
  static async updateRegistrationStatus(
    voterId: number,
    electionId: number,
    status: OnchainStatus,
    txHash?: string,
    batchId?: string,
  ): Promise<void> {
    const repository = dataSource.getRepository(BlindedSignature)
    await repository.update(
      { voterId, electionId },
      {
        onchainStatus: status,
        txHash: txHash || null,
        batchId: batchId || null,
      },
    )
  }
}
