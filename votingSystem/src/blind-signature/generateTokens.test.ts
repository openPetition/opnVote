import { ethers } from 'ethers';
import { TestRegister } from '../config';
import { MasterKey } from '../types/types';
import { signToken, validateBase64, validateBlsSignature, validateMasterKey, validateR, validateToken } from '../utils/utils';
import { generateMasterKey, masterKeyToQR, qrToMasterKey, deriveElectionWallet, deriveElectionUnblindedToken, generateBlindingR, unblindSignature, blindToken, verifyUnblindedSignature } from './generateTokens';




// Generate Master Key

describe('generateMasterKey', () => {
    it('should generate a master key', () => {
        const masterKey = generateMasterKey();

        expect(() => validateMasterKey(masterKey)).not.toThrow();
        expect(masterKey.hexString.startsWith('0x')).toBe(true);
    });
});


// MasterKey QR Code Generation and Parsing

describe('MasterKey QR Code Generation and Parsing', () => {
    let masterKeys: MasterKey[] = [];

    beforeAll(() => {
        for (let i = 0; i < 100; i++) {
            masterKeys.push(generateMasterKey());
        }
    });

    it('should correctly encode a master key into a Base64 string', () => {
        masterKeys.forEach((masterKey) => {
            const qrString = masterKeyToQR(masterKey);
            expect(() => validateBase64(qrString)).not.toThrow();
        });
    });

    it('should correctly decode a QR code string back into a master key', () => {
        masterKeys.forEach((masterKey) => {
            const qrString = masterKeyToQR(masterKey);
            const decoded = qrToMasterKey(qrString);

            expect(decoded.hexString).toBe(masterKey.hexString);
            expect(() => validateMasterKey(decoded)).not.toThrow();
        });
    });
});


// Derive Election-specific Voter Wallet from Master Key
describe('deriveElectionWallet', () => {
    let masterKey: MasterKey;

    beforeAll(() => {
        masterKey = generateMasterKey();
    });

    it('should derive same wallet for same master key and election ID', () => {
        const electionID = 42;
        const w1 = deriveElectionWallet(masterKey, electionID);
        const w2 = deriveElectionWallet(masterKey, electionID);

        expect(w1.address).toBe(w2.address);
        expect(w1.privateKey).toBe(w2.privateKey);
    });

    it('should derive different wallets for different election IDs', () => {
        const w1 = deriveElectionWallet(masterKey, 1);
        const w2 = deriveElectionWallet(masterKey, 2);

        expect(w1.address).not.toBe(w2.address);
    });

    it('should derive different wallets for different master keys', () => {
        const otherMasterKey = generateMasterKey();
        const w1 = deriveElectionWallet(masterKey, 1);
        const w2 = deriveElectionWallet(otherMasterKey, 1);

        expect(w1.address).not.toBe(w2.address);
    });
});


// Derive Unblinded Election Token from electionID and voter address

describe('deriveElectionUnblindedToken', () => {

    let voterAddress: string;

    beforeAll(() => {
        voterAddress = ethers.Wallet.createRandom().address;
    });

    it('should derive the same token for same election ID and voter address', () => {
        const numberOfTests = 100;
        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000);

            const token1 = deriveElectionUnblindedToken(electionID, voterAddress);
            const token2 = deriveElectionUnblindedToken(electionID, voterAddress);

            expect(() => validateToken(token1)).not.toThrow();
            expect(token1.hexString).toBe(token2.hexString);
            expect(token1.isBlinded).toBe(false);
        }
    });

    it('should derive different tokens for different election IDs with same voter address', () => {
        const numberOfTests = 20;
        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000);

            const token1 = deriveElectionUnblindedToken(electionID, voterAddress);
            const token2 = deriveElectionUnblindedToken(electionID + 1, voterAddress);

            expect(token1.hexString).not.toBe(token2.hexString);
        }
    });

    it('should derive different tokens for different voter addresses with the same election ID', () => {
        const otherAddress = ethers.Wallet.createRandom().address;
        const token1 = deriveElectionUnblindedToken(1, voterAddress);
        const token2 = deriveElectionUnblindedToken(1, otherAddress);

        expect(token1.hexString).not.toBe(token2.hexString);
    });

    it('should match the on-chain unblinded token (keccak256(electionId, voterAddress))', () => {
        const electionID = 7;
        const token = deriveElectionUnblindedToken(electionID, voterAddress);
        const expected = ethers.solidityPackedKeccak256(['uint256', 'address'], [BigInt(electionID), voterAddress]);

        expect(token.hexString).toBe(expected);
    });
});


// Generate blinding factor R

describe('generateBlindingR', () => {
    it('should produce a valid Fr sk', () => {
        for (let i = 0; i < 20; i++) {
            const r = generateBlindingR(generateMasterKey(), i);
            expect(() => validateR(r)).not.toThrow();
        }
    });

    it('should derive same R for same master key and election ID', () => {
        const masterKey = generateMasterKey();
        for (let i = 0; i < 20; i++) {
            const electionID = Math.floor(Math.random() * 1000);
            const r1 = generateBlindingR(masterKey, electionID);
            const r2 = generateBlindingR(masterKey, electionID);

            expect(() => validateR(r1)).not.toThrow();
            expect(r1.hexString).toBe(r2.hexString);
        }
    });

    it('should derive different R for different election ID', () => {
        const masterKey = generateMasterKey();
        const r1 = generateBlindingR(masterKey, 1);
        const r2 = generateBlindingR(masterKey, 2);
        expect(r1.hexString).not.toBe(r2.hexString);
    });

    it('should derive different R for different master keys', () => {
        const r1 = generateBlindingR(generateMasterKey(), 1);
        const r2 = generateBlindingR(generateMasterKey(), 1);
        expect(r1.hexString).not.toBe(r2.hexString);
    });

    it('should not derive equal wallet private key and r', () => {
        const masterKey = generateMasterKey();
        const electionID = 42;
        const r = generateBlindingR(masterKey, electionID);
        const wallet = deriveElectionWallet(masterKey, electionID);
        expect(r.hexString).not.toBe(wallet.privateKey);
    });

    it('should throw if masterKey or electionID is missing', () => {
        const masterKey = generateMasterKey();
        expect(() => (generateBlindingR as any)()).toThrow();
        expect(() => (generateBlindingR as any)(masterKey)).toThrow();
        expect(() => (generateBlindingR as any)(undefined, 1)).toThrow();
    });
});


// Full BLS Blind-Signature Flow (blind → sign → unblind → verify)

describe('BLS blind-signature flow', () => {
    let masterKey: MasterKey;

    beforeAll(() => {
        masterKey = generateMasterKey();
    });

    it('should produce valid signature that verifies against unblinded token and register pk', () => {
        const numberOfTests = 5;

        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000);
            const voterWallet = deriveElectionWallet(masterKey, electionID);
            const unblindedElectionToken = deriveElectionUnblindedToken(electionID, voterWallet.address);
            const r = generateBlindingR(masterKey, electionID);

            expect(() => validateToken(unblindedElectionToken)).not.toThrow();
            expect(() => validateR(r)).not.toThrow();

            const blindedElectionToken = blindToken(unblindedElectionToken, r);
            expect(() => validateToken(blindedElectionToken)).not.toThrow();
            expect(blindedElectionToken.isBlinded).toBe(true);

            const blindedSignature = signToken(blindedElectionToken, TestRegister);
            expect(() => validateBlsSignature(blindedSignature)).not.toThrow();
            expect(blindedSignature.isBlinded).toBe(true);

            const unblinded = unblindSignature(blindedSignature, r);
            expect(() => validateBlsSignature(unblinded)).not.toThrow();
            expect(unblinded.isBlinded).toBe(false);

            const isValid = verifyUnblindedSignature(unblinded, unblindedElectionToken, TestRegister);
            expect(isValid).toBe(true);
        }
    });

    it('should create valid signature with deterministic R', () => {
        const electionID = 28;
        const voterWallet = deriveElectionWallet(masterKey, electionID);
        const unblindedElectionToken = deriveElectionUnblindedToken(electionID, voterWallet.address);
        const r = generateBlindingR(masterKey, electionID);

        const blindedElectionToken = blindToken(unblindedElectionToken, r);
        const blindedSignature = signToken(blindedElectionToken, TestRegister);
        const unblinded = unblindSignature(blindedSignature, r);

        expect(verifyUnblindedSignature(unblinded, unblindedElectionToken, TestRegister)).toBe(true);

        const rSecond = generateBlindingR(masterKey, electionID);
        expect(blindToken(unblindedElectionToken, rSecond).hexString).toBe(blindedElectionToken.hexString);
    });

    it('should fail verification when unblinded token is replaced by a token derived from a different voter address', () => {
        const numberOfTests = 2;

        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000);
            const voterWallet = deriveElectionWallet(masterKey, electionID);
            const unblindedElectionToken = deriveElectionUnblindedToken(electionID, voterWallet.address);
            const r = generateBlindingR(masterKey, electionID);

            const blindedElectionToken = blindToken(unblindedElectionToken, r);
            const blindedSignature = signToken(blindedElectionToken, TestRegister);
            const unblinded = unblindSignature(blindedSignature, r);

            const otherAddress = ethers.Wallet.createRandom().address;
            const invalidUnblindedElectionToken = deriveElectionUnblindedToken(electionID, otherAddress);

            const isValid = verifyUnblindedSignature(unblinded, invalidUnblindedElectionToken, TestRegister);
            expect(isValid).toBe(false);
        }
    });
});




