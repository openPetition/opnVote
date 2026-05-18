import { PrivateKeyDer, PublicKeyDer } from '../types/types';
import * as crypto from 'crypto'
import { bls12_381 } from '@noble/curves/bls12-381';
import { bytesToNumberBE } from '@noble/curves/abstract/utils';
import { getSubtleCrypto, validateBlsParams } from '../utils/utils';
import { BlsParams } from '../types/types';
import { RSA_BIT_LENGTH } from '../utils/constants';

/**
 * Generates an RSA public-private key pair (der-format)
 * @returns Object containing the der-formatted publicKey and privateKey as hex-strings
 */
export async function generateKeyPair(): Promise<{ publicKey: PublicKeyDer, privateKey: PrivateKeyDer }> {
    const subtle: SubtleCrypto | crypto.webcrypto.SubtleCrypto = getSubtleCrypto()

    const keyPair = await subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: RSA_BIT_LENGTH,
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
 * Generates an uncompressed BLS12-381 key pair for blind signature issuance
 * @returns {BlsParams} BLS BLS12-381 key pair
 */
export function generateKeyPairRaw(): BlsParams {
    const sk = bytesToNumberBE(bls12_381.utils.randomPrivateKey());

    const pkPoint = bls12_381.shortSignatures.getPublicKey(sk);
    const blsParams: BlsParams = {
        pk: '0x' + pkPoint.toHex(false), // uncompressed (386 chars)
        sk: sk,

    };

    validateBlsParams(blsParams);
    return blsParams;
}

