import { generateKeyPair, generateKeyPairRaw, signDummyToken, validateKeyPair } from './generateKeyPair';
import { verifyUnblindedSignature } from '../blind-signature/generateTokens';
import { isValidHex, validateBlsParams } from '../utils/utils'
import { BlsParams } from '../types/types';
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

describe('validateKeyPair', () => {
    it('should accept a generated key pair', async () => {
        const { publicKey, privateKey } = await generateKeyPair();
        await expect(validateKeyPair(publicKey, privateKey)).resolves.toBeUndefined();
    });

    it('should reject keys of two different pairs', async () => {
        const [a, b] = await Promise.all([generateKeyPair(), generateKeyPair()]);
        await expect(validateKeyPair(a.publicKey, b.privateKey)).rejects.toThrow('Failed to decrypt votes');
    });

    it('should reject a malformed private key', async () => {
        const { publicKey, privateKey } = await generateKeyPair();
        const broken = privateKey.slice(0, -2) + 'zz';

        const error: Error = await validateKeyPair(publicKey, broken).catch((e) => e);
        expect(error.message).toContain(`Invalid hex string: ${broken.slice(0, 6)}...`);
    });
});

describe('generateKeyPairRaw', () => {
    it('should generate valid raw BLS key pair', () => {

        const blsParams: BlsParams = generateKeyPairRaw();

        expect(blsParams.sk).toBeDefined();
        expect(blsParams.pk).toBeDefined();

        expect(blsParams.sk!).toBeGreaterThan(0n);
        expect(blsParams.sk!).toBeLessThan(bls12_381.fields.Fr.ORDER);

        expect(blsParams.pk.startsWith('0x')).toBe(true);
        expect(isValidHex(blsParams.pk, true)).toBe(true);
        expect(blsParams.pk.length).toBe(BLS_G2_HEX_LENGTH);

        const expectedPk = '0x' + bls12_381.shortSignatures.getPublicKey(blsParams.sk!).toHex(false);
        expect(blsParams.pk).toBe(expectedPk);

        expect(() => validateBlsParams(blsParams)).not.toThrow();
    });
});

describe('validateBlsParams', () => {
    it('should reject identity point as pk', () => {
        const identityHex = '0x' + bls12_381.curves.G2.BASE.subtract(bls12_381.curves.G2.BASE).toHex(false);
        expect(() => validateBlsParams({ pk: identityHex })).toThrow("BLS pk is the identity point");
    });

    it('should reject sk that does not match pk', () => {
        const valid = generateKeyPairRaw();
        const mismatched: BlsParams = { sk: valid.sk! + 1n, pk: valid.pk };
        expect(() => validateBlsParams(mismatched)).toThrow("BLS pk and sk do not match");
    });

    it('should reject sk outside Fr', () => {
        const valid = generateKeyPairRaw();
        expect(() => validateBlsParams({ sk: 0n, pk: valid.pk })).toThrow("BLS sk is out of range");
        expect(() => validateBlsParams({ sk: bls12_381.fields.Fr.ORDER, pk: valid.pk })).toThrow("BLS sk is out of range");
    });
});

describe('signDummyToken', () => {
    it('should sign a dummy token that verifies only with the correct public key', () => {
        const blsParams = generateKeyPairRaw();
        const { message, signature } = signDummyToken(blsParams);

        const raw = signature.slice(2);
        const unpadded = { hexString: '0x' + raw.slice(32, 128) + raw.slice(160, 256), isBlinded: false };
        const token = { hexString: message, isBlinded: false };
        expect(verifyUnblindedSignature(unpadded, token, { pk: blsParams.pk })).toBe(true);
        expect(verifyUnblindedSignature(unpadded, token, { pk: generateKeyPairRaw().pk })).toBe(false);
    });
});
