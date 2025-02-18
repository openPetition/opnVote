import { ethers } from "ethers";
import { EthSignature, VotingTransaction } from "../types/types";
import { validateVotingTransaction } from "../utils/utils";

/**
 * Signs a voting transaction using the provided signing key.
 * @param {VotingTransaction} votingTransaction - Voting transaction to be signed
 * @param {string} signingKey - Private key to sign the transaction
 * @returns {Promise<EthSignature>} Resolves to the signature object
 * @throws {Error} if the SVS signature is already set, if the signing key is invalid, or if an error occurs during the signing process
 */
export async function signVotingTransaction(votingTransaction: VotingTransaction, signingKey: string): Promise<EthSignature> {

    if (votingTransaction.svsSignature) {
        throw new Error("SVS Signature already set")
    }

    validateVotingTransaction(votingTransaction)

    let wallet: ethers.Wallet;

    try {
        wallet = new ethers.Wallet(signingKey);
    } catch (err) {
        throw new Error(`Error creating ethers Wallet: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
        const message = ethers.solidityPackedKeccak256(
            ['uint256', 'address', 'bytes', 'bytes', 'bytes', 'bytes'],
            [
                votingTransaction.electionID,
                votingTransaction.voterAddress,
                votingTransaction.encryptedVoteRSA.hexString,
                votingTransaction.encryptedVoteAES.hexString,
                votingTransaction.unblindedElectionToken.hexString,
                votingTransaction.unblindedSignature.hexString
            ]
        );
        const signatureHexString = await wallet.signMessage(ethers.toBeArray(message));
        return { hexString: signatureHexString };

    } catch (err) {
        throw new Error(`Error signing voting transaction: ${err instanceof Error ? err.message : String(err)}`);
    }
}
