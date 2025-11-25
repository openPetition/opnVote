/**
 * Represents the status and relevant details of an election.
 * @property {number} status -  Status code of the election (0 pending, 1 open, 2 ended, 3 Results published, 4 canceled).
 * @property {string} votingEndTime - Unix Timestamp when voting ends
 * @property {string} registrationStartTime - Unix Timestamp when registration starts
 * @property {string} registrationEndTime - Unix Timestamp when registration ends
 */
export interface ElectionStatusResponse {
  status: number
  votingEndTime: string
  registrationStartTime: string
  registrationEndTime: string
}
