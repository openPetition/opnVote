import { dataSource } from '../database';
import { BlindedSignature } from '../models/BlindedSignature';

type OnchainStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';

/**
 * Service for managing locally stored blinded signatures (fetching, updating, etc)
 */
export class BlindedSignatureService {

  /**
   * Get pending registrations (currently not confirmed on-chain)
   * @returns Pending registrations
   */
  static async getPendingRegistrations(): Promise<BlindedSignature[]> {
    const repository = dataSource.getRepository(BlindedSignature);
    return repository.find({
      where: {
        onchainStatus: 'pending'
      }
    });
  }

  /**
   * Update the status of a registration
   * @param id - The ID of the registration
   * @param status - The on-chain status of the registration
   * @param txHash - The on-chain transaction hash of the registration
   * @param batchID - The batch ID of the registration
   */
  static async updateRegistrationStatus(userID: number, electionID: number, status: OnchainStatus, txHash?: string, batchID?: string): Promise<void> {
    const repository = dataSource.getRepository(BlindedSignature);
    await repository.update({ userID, electionID }, {
      onchainStatus: status,
      txHash: txHash || null,
      batchID: batchID || null
    });
  }
}

