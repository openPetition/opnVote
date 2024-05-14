import { generateKeyPair, generateKeyPairRaw } from './generateRSAKeys';
import { isValidHex } from '../utils/utils'
describe('generateKeyPair', () => {
    it('should generate a valid RSA key pair', () => {
        const { publicKey, privateKey } = generateKeyPair();

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
        const { e, n, d } = generateKeyPairRaw();

        // Components should be a hex-string
        expect(e.startsWith('0x')).toBe(true);
        expect(n.startsWith('0x')).toBe(true);
        expect(d.startsWith('0x')).toBe(true);

        expect(isValidHex(e)).toBe(true);
        expect(isValidHex(n)).toBe(true);
        expect(isValidHex(d)).toBe(true);

        // Check the length of 'e' (usually 0x10001)
        expect(e.length).toBeGreaterThanOrEqual(7); 
        // Check the length of 'n' (2048 bits, 256 bytes + potential leading zeros)
        expect(n.length).toBeGreaterThanOrEqual(514); 
        expect(n.length).toBeLessThanOrEqual(516);  // Allowing leading zeros

         // Check the length of 'd' (similar size to 'n')
         expect(d.length).toBeGreaterThanOrEqual(514); 
         expect(d.length).toBeLessThanOrEqual(516); // Allowing leading zeros
    });
});
