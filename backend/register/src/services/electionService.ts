import { fetchElectionEndTimeStatus } from '../graphql/graphqlClient'
import { ElectionStatusResponse } from '../types/graphql'

/**
 * Functionality for fetching and managing the status of an election.
 *
 * Responsible for:
 * - Fetching on-chain election status and end time via GraphQL
 * - Determining whether an election is closed based on the fetched status and end time.
 */
export class ElectionStatusService {
  /**
   * Fetches the election status and end time for a given election Id using GraphQL.
   *
   * @param {number} electionId - Identifier for the election.
   * @returns {Promise<ElectionStatusResponse | null>} Resolves to current on-chain election status and end time, or null if election not found.
   */
  static async getElectionStatus(electionId: number): Promise<ElectionStatusResponse | null> {
    try {
      const electionData = await fetchElectionEndTimeStatus(electionId)
      return electionData
    } catch (error) {
      console.error('Error fetching election status:', error)
      return null
    }
  }

  /**
   * Checks if an election is closed based on the election status and end Time
   *
   * @param {ElectionStatusResponse | null} electionData - election data returned by `getElectionStatus`.
   * @returns {boolean} `true` if the election is closed, `false` otherwise.
   */
  static isElectionClosed(electionData: ElectionStatusResponse | null): boolean {
    // Closed if no election data present
    if (!electionData) {
      return true
    }

    const now = Math.floor(Date.now() / 1000)

    // Election status values:
    // 0 - Pending
    // 1 - Active
    // 2 - Ended
    // 3 - ResultsPublished
    // 4 - Canceled

    // If the status is Ended, ResultsPublished, or Canceled, the election is closed
    if (electionData.status > 1 && electionData.status <= 4) {
      return true
    }

    // If the status is Active and but the closing time is past, the election is closed
    if (electionData.status === 1 && now >= parseInt(electionData.votingEndTime)) {
      return true
    }

    // If none of the above true, the election is open
    return false
  }

  /**
   * Checks if registration is closed based on the registration start and end times
   *
   * @param {ElectionStatusResponse | null} electionData - election data returned by `getElectionStatus`.
   * @returns {boolean} `true` if registration is closed, `false` otherwise.
   */
  static isRegistrationClosed(electionData: ElectionStatusResponse | null): boolean {
    // Closed if no election data present
    if (!electionData) {
      return true
    }

    const now = Math.floor(Date.now() / 1000)
    const registrationStartTime = parseInt(electionData.registrationStartTime)
    const registrationEndTime = parseInt(electionData.registrationEndTime)

    // If registrationStartTime is 0 or not set -> registration start time check is not enforced
    if (registrationStartTime !== 0 && now < registrationStartTime) {
      return true
    }

    // If registrationEndTime is 0 or not set -> registration end time check is not enforced
    // Check if registration end time has passed
    if (registrationEndTime !== 0 && now >= registrationEndTime) {
      return true
    }

    // Registration is open
    return false
  }
}
