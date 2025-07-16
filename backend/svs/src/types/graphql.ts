/**
 * Represents the status and relevant details of an election.
 * @property {number} status -  Status code of the election (0 pending, 1 open, 2 ended, 3 Results published, 4 canceled).
 * @property {string} endTime - Unix Timestamp when election ends
 */
export interface ElectionStatusResponse {
  status: number
  voteEndTime: string
}

/**
 * Represents Register Public Key components
 * @property {string} registerPublicKeyE - The public exponent (E)
 * @property {string} registerPublicKeyN - The public modulus (N)
 */
export interface ElectionRegisterPublicKeyResponse {
  registerPublicKeyE: string
  registerPublicKeyN: string
}
