import { generateKeyPairSync } from 'crypto';
import NodeRSA from 'node-rsa';
import { PrivateKeyDer, PublicKeyDer } from '../types/types';

/**
 * Generates an RSA public-private key pair (der-format)
 * @returns Object containing the der-formatted publicKey and privateKey as hex-strings
 */
export function generateKeyPair(): { publicKey: PublicKeyDer, privateKey: PrivateKeyDer } {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'der'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'der'
        }
    });

    return {
        publicKey: '0x' + publicKey.toString('hex'),
        privateKey: '0x' + privateKey.toString('hex')
    };
}


/**
 * Generates a raw RSA public-private key pair for blind signatures
 * @returns Object containing the raw components of the RSA keys as hex-strings
 */
export function generateKeyPairRaw(): { e: string, n: string, d:string }{
    const key = new NodeRSA({ b: 2048 });

    const publicKeyComponents = key.exportKey('components-public');
    const privateKeyComponents = key.exportKey('components-private');

    return {
        e: '0x' + (Buffer.isBuffer(publicKeyComponents.e) ? publicKeyComponents.e.toString('hex') : publicKeyComponents.e.toString(16)),
        n: '0x' + publicKeyComponents.n.toString('hex'), 
        d: '0x' + privateKeyComponents.d.toString('hex') 
     };
}