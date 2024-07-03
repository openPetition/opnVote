import NodeRSA from 'node-rsa';
import { PrivateKeyDer, PublicKeyDer } from '../types/types';
import * as crypto from 'crypto'
import { getSubtleCrypto } from '../utils/utils';

/**
 * Generates an RSA public-private key pair (der-format)
 * @returns Object containing the der-formatted publicKey and privateKey as hex-strings
 */
export async function generateKeyPair(): Promise<{ publicKey: PublicKeyDer, privateKey: PrivateKeyDer }> {
    const subtle: SubtleCrypto|crypto.webcrypto.SubtleCrypto = getSubtleCrypto()

    const keyPair = await subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: { name: "SHA-256" },
        },
        true,
        ["encrypt", "decrypt"]
    );

    const publicKey = await subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await subtle.exportKey('pkcs8', keyPair.privateKey);

    const publicKeyHex = '0x' + Buffer.from(publicKey).toString('hex');
    const privateKeyHex = '0x' + Buffer.from(privateKey).toString('hex');

    return {
        publicKey: publicKeyHex,
        privateKey: privateKeyHex
    };
}

/**
 * Generates a raw RSA public-private key pair for blind signatures
 * @returns Object containing the raw components of the RSA keys as hex-strings
 */
export function generateKeyPairRaw(): { e: string, n: string, d: string } {
    const key = new NodeRSA({ b: 2048 });

    const publicKeyComponents = key.exportKey('components-public');
    const privateKeyComponents = key.exportKey('components-private');

    return {
        e: '0x' + (Buffer.isBuffer(publicKeyComponents.e) ? publicKeyComponents.e.toString('hex') : publicKeyComponents.e.toString(16)),
        n: '0x' + publicKeyComponents.n.toString('hex'),
        d: '0x' + privateKeyComponents.d.toString('hex')
    };
}
