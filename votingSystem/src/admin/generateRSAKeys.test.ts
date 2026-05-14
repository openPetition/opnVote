import { generateKeyPair, generateKeyPairRaw } from './generateRSAKeys';
import { isValidHex, validateBLSParams } from '../utils/utils'
import { BLSParams } from '../types/types';
import { BLS_G2_HEX_LENGTH } from '../utils/constants';
import { bls12_381 } from '@noble/curves/bls12-381';

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
    it('should generate valid raw BLS key pair', () => {

        const blsParams: BLSParams = generateKeyPairRaw();

        expect(blsParams.sk).toBeDefined();
        expect(blsParams.pk).toBeDefined();

        expect(blsParams.sk!).toBeGreaterThan(0n);
        expect(blsParams.sk!).toBeLessThan(bls12_381.fields.Fr.ORDER);

        expect(blsParams.pk.startsWith('0x')).toBe(true);
        expect(isValidHex(blsParams.pk, true)).toBe(true);
        expect(blsParams.pk.length).toBe(BLS_G2_HEX_LENGTH);

        const expectedPk = '0x' + bls12_381.G2.Point.BASE.multiply(blsParams.sk!).toHex(false);
        expect(blsParams.pk).toBe(expectedPk);

        expect(() => validateBLSParams(blsParams)).not.toThrow();
    });
});

describe('validateBLSParams', () => {
    it('should reject identity point as pk', () => {
        const identityHex = '0x' + bls12_381.G2.Point.BASE.subtract(bls12_381.G2.Point.BASE).toHex(false);
        expect(() => validateBLSParams({ pk: identityHex })).toThrow("BLS pk is the identity point");
    });

    it('should reject sk that does not match pk', () => {
        const valid = generateKeyPairRaw();
        const mismatched: BLSParams = { sk: valid.sk! + 1n, pk: valid.pk };
        expect(() => validateBLSParams(mismatched)).toThrow("BLS pk and sk do not match");
    });

    it('should reject sk outside Fr', () => {
        const valid = generateKeyPairRaw();
        expect(() => validateBLSParams({ sk: 0n, pk: valid.pk })).toThrow("BLS sk is out of range");
        expect(() => validateBLSParams({ sk: bls12_381.fields.Fr.ORDER, pk: valid.pk })).toThrow("BLS sk is out of range");
    });
});
