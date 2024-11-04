import { RSAParams, getBitLength, validateRSAParams } from "votingsystem";
import { fetchElectionEndTimeStatus, fetchElectionRegisterPublicKey } from "../graphql/graphqlClient";
import { ElectionStatusResponse } from "../types/graphql";
import { logger } from "../utils/logger";

export class ElectionService {

    /**
    * Fetches the election Public Key using GraphQL.
    *
    * @param {number} electionId - Identifier for the election.
    * @returns {Promise<ElectionStatusResponse | null>} // Resolves to current on-chain election status and end time, or null if election not found.
    */
    static async getElectionRegisterPublicKey(electionId: number): Promise<RSAParams | null> {
        try {
            const electionData = await fetchElectionRegisterPublicKey(electionId);
            if (!electionData) { return null }

            const N = BigInt(electionData.registerPublicKeyN)
            const e = BigInt(electionData.registerPublicKeyE)
            const NBitLength = getBitLength(N)
            const rsaParams = { N: N, e: e, NbitLength: NBitLength }
            validateRSAParams(rsaParams)
            return rsaParams;
        } catch (error) {
            logger.error('Error fetching election status:', error);
            return null;
        }
    }



    /**
    * Fetches the election status and end time for a given election ID using GraphQL.
    *
    * @param {number} electionId - Identifier for the election.
    * @returns {Promise<ElectionStatusResponse | null>} Resolves to current on-chain election status and end time, or null if election not found.
    */
    static async getElectionStatus(electionId: number): Promise<ElectionStatusResponse | null> {
        try {
            const electionData: ElectionStatusResponse | null = await fetchElectionEndTimeStatus(electionId);
            return electionData;
        } catch (error) {
            // logger.error('Error fetching election status:', error);
            return null;
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
            return true;
        }

        const now = Math.floor(Date.now() / 1000);


        // Election status values:
        // 0 - Pending
        // 1 - Active
        // 2 - Ended
        // 3 - ResultsPublished
        // 4 - Canceled

        // If the status is Ended, ResultsPublished, or Canceled, the election is closed
        if (electionData.status > 1 && electionData.status <= 4) {
            return true;
        }

        // If the status is Active and but the closing time is past, the election is closed
        if (electionData.status === 1 && now >= parseInt(electionData.endTime)) {
            return true;
        }

        // If none of the above true, the election is open
        return false;
    }
}
