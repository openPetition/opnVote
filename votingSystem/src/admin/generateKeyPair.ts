import { PrivateKeyDer, PublicKeyDer } from '../types/types';
import { ethers } from 'ethers'
import { bls12_381 } from '@noble/curves/bls12-381';
import { bytesToNumberBE } from '@noble/curves/abstract/utils';
import { getSubtleCrypto, nobleG1ToEvm, signToken, validateBlsParams } from '../utils/utils';
import { BlsParams, EncryptionType, Vote, VoteOption } from '../types/types';
import { RSA_BIT_LENGTH } from '../utils/constants';
import { decryptVotes, encryptVotes } from '../voting/voting';
import { blindToken, deriveElectionUnblindedToken, deriveElectionWallet, generateBlindingR, generateMasterKey, unblindSignature } from '../blind-signature/generateTokens';

/**
 * Generates an RSA public-private key pair (der-format)
 * @returns Object containing the der-formatted publicKey and privateKey as hex-strings
 */
export async function generateKeyPair(): Promise<{ publicKey: PublicKeyDer, privateKey: PrivateKeyDer }> {
    const subtle = getSubtleCrypto()

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

    const publicKeyHex = ethers.hexlify(new Uint8Array(publicKey));
    const privateKeyHex = ethers.hexlify(new Uint8Array(privateKey));

    await validateKeyPair(publicKeyHex, privateKeyHex);
    return {
        publicKey: publicKeyHex,
        privateKey: privateKeyHex
    };
}

/**
 * Validates an RSA key pair (DER format)
 * @param publicKey
 * @param privateKey
 * @throws if key is malformed or keys dont match
 */
export async function validateKeyPair(publicKey: PublicKeyDer, privateKey: PrivateKeyDer): Promise<void> {
    
    const DUMMY_VOTES: Vote[] = [
        { value: VoteOption.Yes },
        { value: VoteOption.No },
        { value: VoteOption.Abstain },
        { value: VoteOption.Invalid },
    ];
    
    const encrypted = await encryptVotes(DUMMY_VOTES, { hexString: publicKey, encryptionType: EncryptionType.RSA }, EncryptionType.RSA);
    const decrypted = await decryptVotes(encrypted, { hexString: privateKey, encryptionType: EncryptionType.RSA }, EncryptionType.RSA);

    if (decrypted.length !== DUMMY_VOTES.length || decrypted.some((vote, i) => vote.value !== DUMMY_VOTES[i].value)) {
        throw new Error('Decrypted votes do not match');
    }
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

/**
 * Signs a dummy token to test bls keys
 * @param blsParams - bls key pair
 * @returns unblinded token its signature
 */
export function signDummyToken(blsParams: BlsParams): { message: string; signature: string } {
    const DUMMY_ELECTION_ID = 1;

    const masterKey = generateMasterKey();
    const wallet = deriveElectionWallet(masterKey, DUMMY_ELECTION_ID);
    const token = deriveElectionUnblindedToken(DUMMY_ELECTION_ID, wallet.address);
    const r = generateBlindingR(masterKey, DUMMY_ELECTION_ID);
    const signature = unblindSignature(signToken(blindToken(token, r), blsParams), r);
    return { message: token.hexString, signature: nobleG1ToEvm(signature.hexString) };
}

