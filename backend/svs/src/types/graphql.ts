/**
 * Represents the status and relevant details of an election.
 * @property {number} status -  Status code of the election (0 pending, 1 open, 2 ended, 3 Results published, 4 canceled).
 * @property {string} endTime - Unix Timestamp when election ends
 */
export interface ElectionStatusResponse {
  status: number;
  endTime: string;
}


export interface ElectionRegisterPublicKeyResponse {
    registerPublicKeyE: string;
    registerPublicKeyN: string;
  }
