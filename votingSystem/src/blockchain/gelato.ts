import { ethers } from "ethers";
import { GelatoRelay, CallWithERC2771Request, SignatureData, ERC2771Type } from "@gelatonetwork/relay-sdk";
import { ElectionCredentials, VotingTransaction } from "../types/types";
import { validateCredentials, validateVotingTransaction } from "../utils/utils";

/**
 * Creates a Gelato ERC2771 sponsored Transaction Request for a voting transaction.
 * @param {VotingTransaction} votingTransaction - The voting transaction to be submitted to Gelato
 * @param {ElectionCredentials} credentials - Credentials of the voter
 * @param {string} opnVoteContractAddress - Address of the OpnVote contract
 * @param {ethers.Interface | ethers.InterfaceAbi} opnVoteABI - ABI of the OpnVote contract
 * @param {ethers.JsonRpcProvider} provider - Ethereum provider
 * @returns {Promise<CallWithERC2771Request>} The Gelato relay request
 * @throws {Error} if validation fails or if an error occurs while creating the relay request
 */
export async function createRelayRequest(
  votingTransaction: VotingTransaction,
  credentials: ElectionCredentials,
  opnVoteContractAddress: string,
  opnVoteABI: ethers.Interface | ethers.InterfaceAbi,
  provider: ethers.JsonRpcProvider,
): Promise<CallWithERC2771Request> {

  // Validate the voting transaction and credentials
  validateVotingTransaction(votingTransaction)
  validateCredentials(credentials)
  const transactionSender = credentials.voterWallet.address;

  // Check if the transaction sender address matches voter address
  if (transactionSender.toLowerCase() !== votingTransaction.voterAddress.toLowerCase()) {
    throw new Error(`Transaction sender (${transactionSender}) does not match voter address (${votingTransaction.voterAddress}).`);
  }

  const svsSignatureHex = votingTransaction.svsSignature ? votingTransaction.svsSignature.hexString : "0x";

  try {
    const opnVoteContract = new ethers.Contract(opnVoteContractAddress, opnVoteABI, credentials.voterWallet);

    // Create transaction calldata
    const { data } = await opnVoteContract.vote.populateTransaction(
      votingTransaction.electionID,
      votingTransaction.voterAddress,
      svsSignatureHex,
      votingTransaction.encryptedVote.hexString,
      votingTransaction.unblindedElectionToken.hexString,
      votingTransaction.unblindedSignature.hexString
    );


    const chainId = (await provider.getNetwork()).chainId
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const userDeadline = currentTimeInSeconds + (3 * 24 * 60 * 60) // 3 days from now as unix timestamp

    return {
      chainId: chainId,
      target: opnVoteContractAddress,
      data: data,
      user: transactionSender,
      userDeadline: userDeadline,
      isConcurrent: false,

    };

  }
  catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create relay request: ${error.message}`);
    } else {
      throw new Error(`Failed to create relay request: ${error}`);
    }
  }
}

/**
 * Creates signature data, allowing third parties to submit the ERC2771 Request to Gelato.
 * @param {CallWithERC2771Request} request - The relay request
 * @param {ElectionCredentials} credentials - Credentials of the voter
 * @param {GelatoRelay} relay - Gelato relay instance
 * @param {ethers.JsonRpcProvider} provider - Ethereum provider
 * @returns {Promise<SignatureData>} The signature data to submit to Gelato
 * @throws {Error} if validation fails or if an error occurs while creating the signature data
 */
export async function createSignatureData(
  request: CallWithERC2771Request,
  credentials: ElectionCredentials,
  relay: GelatoRelay,
  provider: ethers.JsonRpcProvider): Promise<SignatureData> {


  validateCredentials(credentials)

  let signerWithProvider: ethers.Wallet
  try {
    signerWithProvider = new ethers.Wallet(credentials.voterWallet.privateKey, provider);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create signer with provider: ${error.message}`);
    } else {
      throw new Error(`Failed to create signer with provider: ${error}`);
    }
  }
  return await relay.getSignatureDataERC2771(request, signerWithProvider, ERC2771Type.SponsoredCall);
}



// TODO: Uncomment this function if direct client->Gelato relay submission should be allowed
// export async function sendRelayRequest(
//   request: CallWithERC2771Request,
//   credentials: ElectionCredentials,
//   apiKey: string,
//   provider: ethers.JsonRpcProvider,
//   relay: GelatoRelay
// ): Promise<RelayResponse> {
//   validateCredentials(credentials);

//   let signerWithProvider: ethers.Wallet;
//   try {
//     signerWithProvider = new ethers.Wallet(credentials.voterWallet.privateKey, provider);
//   } catch (error) {
//     if (error instanceof Error) {
//       throw new Error(`Failed to create signer with provider: ${error.message}`);
//     } else {
//       throw new Error(`Failed to create signer with provider: ${error}`);
//     }
//   }
//   return await relay.sponsoredCallERC2771(request, signerWithProvider, apiKey);
// }




