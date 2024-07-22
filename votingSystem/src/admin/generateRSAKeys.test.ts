import { generateKeyPair, generateKeyPairRaw } from './generateRSAKeys';
import { getBitLength, isValidHex, validateRSAParams } from '../utils/utils'
import { RSAParams } from '../types/types';
import { RSA_BIT_LENGTH } from '../utils/constants';

describe('generateKeyPair', () => {
    it('should generate a valid RSA key pair', async () => {
        const { publicKey, privateKey } = await generateKeyPair();

        // Keys should be a hex-string
        expect(publicKey.startsWith('0x')).toBe(true);
        expect(privateKey.startsWith('0x')).toBe(true);
        expect(isValidHex(publicKey)).toBe(true);
        expect(isValidHex(privateKey)).toBe(true);

        // Check public key length (2048 bits RSA pubKey)
        expect(publicKey.length).toBeGreaterThanOrEqual(580);

        // Check private key length (2048 bits RSA privKey)
        expect(privateKey.length).toBeGreaterThan(2200);

    });
});

describe('generateKeyPairRaw', () => {
    it('should generate valid raw RSA key pair components', () => {

        const rsaParams: RSAParams = generateKeyPairRaw();

        expect(rsaParams.D).toBeDefined();
        expect(rsaParams.e).toBeDefined();

        expect(rsaParams.e).toBeGreaterThan(3);

        expect(rsaParams.NbitLength).toBeGreaterThanOrEqual(1024);
        expect(rsaParams.NbitLength).toBe(RSA_BIT_LENGTH)
        expect(getBitLength(rsaParams.N)).toBe(rsaParams.NbitLength)
        expect(() => validateRSAParams(rsaParams)).not.toThrow();
    });
});
