import { ethers } from "ethers";
import { createRelayRequest } from "./gelato";
import { ElectionCredentials, Signature, Token, VotingTransaction } from "../types/types";

describe("createRelayRequest", () => {
    let mockProvider: ethers.JsonRpcProvider;
    const contractAddress: string = "0x0000000000000000000000000000000000000000";
    const shortABI = [
        {
            type: "function",
            name: "vote",
            inputs: [
                { name: "electionID", type: "uint256", internalType: "uint256" },
                { name: "voter", type: "address", internalType: "address" },
                { name: "svsSignature", type: "bytes", internalType: "bytes" },
                { name: "vote_encrypted", type: "bytes", internalType: "bytes" },
                { name: "unblindedElectionToken", type: "bytes", internalType: "bytes" },
                { name: "unblindedSignature", type: "bytes", internalType: "bytes" }
            ],
            outputs: [],
            stateMutability: "nonpayable"
        }
    ];

    beforeEach(() => {
        mockProvider = {
            getNetwork: jest.fn().mockResolvedValue({ chainId: 100 }),
        } as unknown as ethers.JsonRpcProvider;
    });


    it("should throw an error if transaction sender does not match voter address", async () => {
        const voterAddressWrong: string = "0x0000000000000000000000000000000000000000"
        const voterWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey)
        const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
        const credentials: ElectionCredentials = {
            electionID: 1,
            voterWallet: voterWallet,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature
        };
        const dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterAddressWrong,
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: null
        };


        await expect(
            createRelayRequest(
                votingTransaction,
                credentials,
                contractAddress,
                shortABI,
                mockProvider
            )
        ).rejects.toThrow(
            `Transaction sender (${voterWallet.address}) does not match voter address (${voterAddressWrong}).`
        );
    });

    it("should calculate the user deadline around 3 days from now", async () => {
        const voterWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey)
        const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
        const credentials: ElectionCredentials = {
            electionID: 1,
            voterWallet: voterWallet,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature
        };
        const dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: null
        };
        const result = await createRelayRequest(
            votingTransaction,
            credentials,
            contractAddress,
            shortABI,
            mockProvider
        );

        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        const expectedDeadlineLowerBound = currentTimeInSeconds + (3 * 24 * 60 * 60) - 30; // Allow a 30-second margin
        const expectedDeadlineUpperBound = currentTimeInSeconds + (3 * 24 * 60 * 60) + 30; // Allow a 30-second margin
        expect(result.userDeadline).toBeGreaterThanOrEqual(expectedDeadlineLowerBound);
        expect(result.userDeadline).toBeLessThanOrEqual(expectedDeadlineUpperBound);
    });

    it("should return a valid CallWithERC2771Request object", async () => {
        const voterWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey)
        const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
        const credentials: ElectionCredentials = {
            electionID: 1,
            voterWallet: voterWallet,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature
        };
        const dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: null
        };
        const result = await createRelayRequest(
            votingTransaction,
            credentials,
            contractAddress,
            shortABI,
            mockProvider
        );
        expect(result).toEqual({
            chainId: 100,
            target: contractAddress,
            data: expect.stringMatching(/^0xff6cc66e/),
            user: voterWallet.address,
            userDeadline: expect.any(Number),
            isConcurrent: false
        });
        expect(result.data.length).toBeGreaterThanOrEqual(1000);

    });
});

