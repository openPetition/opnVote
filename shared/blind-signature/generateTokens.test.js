"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generateTokens_1 = require("./generateTokens");
const TestRegister = {
    N: BigInt("0xb04da828580e20ca83f0de9c0c62a201bf5d4b3afa8131e6dbd56efcdbc43bf1c66f1e27b24631ee13cba9c5e783560db2f7aae59fd88c7d381fe10519f84329"),
    D: BigInt("0x9363C8B239B34DFCA0434D877DDF337B6C854D30785E6BDE89682C8A5E1BF6D3ECE0058816A2D260E233106581A11A27DBE43ADA133F9D71D307D261491B8B15"), // Private Key (DUMMY)
    NbitLength: 512, // Bit length of N
};
//Generate Master Token and Master R
describe('generateMasterTokenAndMasterR', () => {
    it('should generate master token and master R', () => {
        const { masterToken, masterR } = (0, generateTokens_1.generateMasterTokenAndMasterR)();
        // Use validateHexString to check the hex string format and length
        expect(() => (0, generateTokens_1.validateToken)(masterToken)).not.toThrow();
        expect(() => (0, generateTokens_1.validateR)(masterR)).not.toThrow();
        expect(masterToken.isMaster).toBe(true);
        expect(masterToken.isBlinded).toBe(false);
        expect(masterR.isMaster).toBe(true);
    });
});
// Concat Token and R for QR Code
describe('QR Code Generation and Parsing', () => {
    let masterTokens = [];
    let masterRs = [];
    beforeAll(() => {
        // Generating 100 pairs of masterToken and masterR
        for (let i = 0; i < 100; i++) {
            const { masterToken, masterR } = (0, generateTokens_1.generateMasterTokenAndMasterR)();
            masterTokens.push(masterToken);
            masterRs.push(masterR);
        }
    });
    it('should correctly concatenate token and r into a Base64 string with a delimiter', () => {
        masterTokens.forEach((masterToken, index) => {
            const masterR = masterRs[index];
            const qrString = (0, generateTokens_1.concatTokenAndRForQR)(masterToken, masterR);
            const parts = qrString.split('|'); // delimiter
            expect(parts.length).toBe(2);
            expect(isValidBase64(parts[0])).toBe(true);
            expect(isValidBase64(parts[1])).toBe(true);
        });
    });
    it('should correctly decode a QR code string back into token and r', () => {
        masterTokens.forEach((masterToken, index) => {
            const masterR = masterRs[index];
            const qrString = (0, generateTokens_1.concatTokenAndRForQR)(masterToken, masterR);
            const { token: decodedToken, r: decodedR } = (0, generateTokens_1.qrToTokenAndR)(qrString, masterToken.isMaster);
            expect(decodedToken.hexString).toBe(masterToken.hexString);
            expect(() => (0, generateTokens_1.validateToken)(decodedToken)).not.toThrow();
            expect(decodedToken.isBlinded).toBe(false);
            expect(decodedR.hexString).toBe(masterR.hexString);
            expect(() => (0, generateTokens_1.validateR)(decodedR)).not.toThrow();
        });
    });
});
// Derive Unblinded Election Token from Master Token
describe('deriveElectionUnblindedToken', () => {
    let masterToken;
    beforeAll(() => {
        const generatedTokens = (0, generateTokens_1.generateMasterTokenAndMasterR)();
        masterToken = generatedTokens.masterToken;
    });
    it('should generate the same unblinded token for the same election ID and master token', () => {
        const numberOfTests = 100;
        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000); // Random election ID
            const token1 = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
            const token2 = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
            expect(() => (0, generateTokens_1.validateToken)(token1)).not.toThrow();
            expect(() => (0, generateTokens_1.validateToken)(token2)).not.toThrow();
            expect(token1.isBlinded).toBe(false);
            expect(token1.isMaster).toBe(false);
            expect(token2.isBlinded).toBe(false);
            expect(token2.isMaster).toBe(false);
        }
    });
    it('should generate different unblinded tokens for different election IDs with the same master token', () => {
        const numberOfTests = 20;
        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000); // Random election ID
            const token1 = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
            const token2 = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID + 1, masterToken);
            expect(() => (0, generateTokens_1.validateToken)(token1)).not.toThrow();
            expect(() => (0, generateTokens_1.validateToken)(token2)).not.toThrow();
            expect(token1.hexString).not.toBe(token2.hexString);
        }
    });
    it('should always generate master Tokens starting with 0x0, a valid hex string, and have correct properties', () => {
        const numberOfTests = 200;
        for (let i = 0; i < numberOfTests; i++) {
            const token = (0, generateTokens_1.deriveElectionUnblindedToken)(i, masterToken);
            expect(token.hexString.startsWith('0x0')).toBe(true);
            expect(() => (0, generateTokens_1.validateToken)(token)).not.toThrow();
            expect(token.isMaster).toBe(false);
            expect(token.isBlinded).toBe(false);
        }
    });
});
describe('deriveElectionR', () => {
    let masterToken, masterR;
    beforeAll(() => {
        const generatedTokens = (0, generateTokens_1.generateMasterTokenAndMasterR)();
        masterToken = generatedTokens.masterToken;
        masterR = generatedTokens.masterR;
    });
    it('should return a valid R', () => {
        const electionID = 1;
        const unblindedToken = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
        const r = (0, generateTokens_1.deriveElectionR)(electionID, masterR, unblindedToken);
        expect(r.hexString.startsWith('0x')).toBe(true);
        expect(() => (0, generateTokens_1.validateR)(r)).not.toThrow();
        expect(r.isMaster).toBe(false);
    });
    it('should produce same R for same inputs', () => {
        const numberOfTests = 5;
        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000); // Random election ID
            const unblindedToken = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
            const r1 = (0, generateTokens_1.deriveElectionR)(electionID, masterR, unblindedToken);
            const r2 = (0, generateTokens_1.deriveElectionR)(electionID, masterR, unblindedToken);
            expect(r1.hexString).toBe(r2.hexString);
            expect(() => (0, generateTokens_1.validateR)(r1)).not.toThrow();
            expect(r1.isMaster).toBe(false);
        }
    });
    it('should produce different R for different unblinded Token', () => {
        const electionID1 = 1;
        const electionID2 = 2;
        const unblindedToken1 = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID1, masterToken);
        const unblindedToken2 = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID2, masterToken);
        expect(() => (0, generateTokens_1.validateToken)(unblindedToken1)).not.toThrow();
        expect(() => (0, generateTokens_1.validateToken)(unblindedToken2)).not.toThrow();
        expect(unblindedToken1.hexString).not.toBe(unblindedToken2.hexString);
        const r1 = (0, generateTokens_1.deriveElectionR)(electionID1, masterR, unblindedToken1);
        const r2 = (0, generateTokens_1.deriveElectionR)(electionID2, masterR, unblindedToken2);
        expect(r1.hexString).not.toBe(r2.hexString);
        expect(() => (0, generateTokens_1.validateR)(r1)).not.toThrow();
        expect(() => (0, generateTokens_1.validateR)(r2)).not.toThrow();
        expect(r1.isMaster).toBe(false);
        expect(r2.isMaster).toBe(false);
    });
});
describe('verifyUnblindedSignature Tests', () => {
    let masterToken, masterR;
    beforeAll(() => {
        const generatedTokens = (0, generateTokens_1.generateMasterTokenAndMasterR)();
        masterToken = generatedTokens.masterToken;
        masterR = generatedTokens.masterR;
    });
    it('should return true for a valid unblinded signature-token pair', () => {
        const numberOfTests = 5;
        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000); // Random election ID
            const unblindedElectionToken = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
            const unblindedElectionR = (0, generateTokens_1.deriveElectionR)(electionID, masterR, unblindedElectionToken);
            expect(() => (0, generateTokens_1.validateToken)(unblindedElectionToken)).not.toThrow();
            expect(() => (0, generateTokens_1.validateR)(unblindedElectionR)).not.toThrow();
            // Blind Election Token
            const blindedElectionToken = (0, generateTokens_1.blindToken)(unblindedElectionToken, unblindedElectionR);
            (0, generateTokens_1.validateToken)(blindedElectionToken);
            expect(() => (0, generateTokens_1.validateToken)(blindedElectionToken)).not.toThrow();
            // Sign blinded Election Token and receive blinded Signature
            const blindedSignature = signToken(blindedElectionToken);
            expect(() => (0, generateTokens_1.validateSignature)(blindedSignature)).not.toThrow();
            // Unblind blinded Signature
            const unblindedSignature = (0, generateTokens_1.unblindSignature)(blindedSignature, unblindedElectionR);
            expect(() => (0, generateTokens_1.validateSignature)(unblindedSignature)).not.toThrow();
            // Verify unblinded Signature
            const isUnblindedSignatureValid = (0, generateTokens_1.verifyUnblindedSignature)(unblindedSignature, unblindedElectionToken);
            expect(isUnblindedSignatureValid).toBe(true);
        }
    });
    it('should return false for a invalid unblinded signature-token pair', () => {
        const numberOfTests = 2;
        for (let i = 0; i < numberOfTests; i++) {
            const electionID = Math.floor(Math.random() * 1000); // Random election ID
            const unblindedElectionToken = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
            const unblindedElectionR = (0, generateTokens_1.deriveElectionR)(electionID, masterR, unblindedElectionToken);
            expect(() => (0, generateTokens_1.validateToken)(unblindedElectionToken)).not.toThrow();
            expect(() => (0, generateTokens_1.validateR)(unblindedElectionR)).not.toThrow();
            // Blind Election Token
            const blindedElectionToken = (0, generateTokens_1.blindToken)(unblindedElectionToken, unblindedElectionR);
            (0, generateTokens_1.validateToken)(blindedElectionToken);
            expect(() => (0, generateTokens_1.validateToken)(blindedElectionToken)).not.toThrow();
            // Sign blinded Election Token and receive blinded Signature
            const blindedSignature = signToken(blindedElectionToken);
            expect(() => (0, generateTokens_1.validateSignature)(blindedSignature)).not.toThrow();
            // Unblind blinded Signature
            const unblindedSignature = (0, generateTokens_1.unblindSignature)(blindedSignature, unblindedElectionR);
            expect(() => (0, generateTokens_1.validateSignature)(unblindedSignature)).not.toThrow();
            // Generate invalid Unblinded Election Token
            const invalidMasterTokenRPair = (0, generateTokens_1.generateMasterTokenAndMasterR)();
            const invalidUnblindedElectionToken = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, invalidMasterTokenRPair.masterToken);
            // Verify unblinded Signature
            const isUnblindedSignatureValid = (0, generateTokens_1.verifyUnblindedSignature)(unblindedSignature, invalidUnblindedElectionToken);
            expect(isUnblindedSignatureValid).not.toBe(true);
        }
    });
});
/*** Helper functions ***/
// Helper function to check if a string is valid Base64
function isValidBase64(str) {
    try {
        return btoa(atob(str)) === str;
    }
    catch (err) {
        return false;
    }
}
//Helper function to sign a token
//Not for production use
function signToken(token) {
    (0, generateTokens_1.validateToken)(token);
    if (!token.isBlinded) {
        throw new Error("Only blinded Tokens can be signed");
    }
    if (token.isMaster) {
        throw new Error("Master Tokens must not be signed");
    }
    const tokenBig = (0, generateTokens_1.hexStringToBigInt)(token.hexString);
    const signatureBig = powermod(tokenBig, TestRegister.D, TestRegister.N); // tokenBig ** TestRegister.D % TestRegister.N;
    const hexLength = TestRegister.NbitLength / 4; // Convert bit length to hex length
    const signatureHex = '0x' + signatureBig.toString(16).padStart(hexLength, '0');
    const blindedSignature = { hexString: signatureHex, isBlinded: true };
    (0, generateTokens_1.validateSignature)(blindedSignature);
    return blindedSignature;
}
// Helper function calculation modpow
// Not for production use
function powermod(base, exp, p) {
    var result = 1n;
    while (exp !== 0n) {
        if (exp % 2n === 1n)
            result = result * base % p;
        base = base * base % p;
        exp >>= 1n;
    }
    return result;
}
