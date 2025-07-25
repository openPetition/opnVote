import { dataSource } from '../database'
import { Authorization } from '../models/Authorization'

type OnchainStatus = 'pending' | 'submitted' | 'confirmed' | 'failed'

/**
 * Service for managing locally stored authorizations (fetching, updating, etc)
 */
export class AuthorizationService {
  /**
   * Get pending authorizations (currently not confirmed on-chain)
   * @returns Pending authorizations
   */
  static async getPendingAuthorizations(): Promise<Authorization[]> {
    const repository = dataSource.getRepository(Authorization)
    return repository.find({
      where: {
        onchainStatus: 'pending',
      },
    })
  }

  /**
   * Update the status of a authorization
   * @param id - The ID of the authorization
   * @param status - The on-chain status of the authorization
   * @param txHash - The on-chain transaction hash of the authorization
   * @param batchId - The batch ID of the authorization
   */
  static async updateAuthorizationStatus(
    voterId: number,
    electionId: number,
    status: OnchainStatus,
    txHash?: string,
    batchId?: string,
  ): Promise<void> {
    const repository = dataSource.getRepository(Authorization)
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
