import { Token, Signature } from './types';
import { isValidHex } from './utility';
import { TestRegister } from './config';

/**
 * Validates a token object.
 * @param token - The token object to be validated.
 * @throws Will throw an error if the token object is invalid.
 */
export function validateToken(token: Token): void {
    if (token.isBlinded && token.isMaster) {
      throw new Error("Master token must not be blinded");
    }
  
    let expectedLength = 66; // Default length for unblinded tokens (SHA-256 Output)
    if (token.isBlinded) {
      expectedLength = (TestRegister.NbitLength / 4) + 2; // Adjust length for blinded tokens: Convert bit length to hex length and add 2 for '0x' prefix.
    }
  
    validateHexString(token, expectedLength);
  }
  
  
  export function validateSignature(signature: Signature): void {
  
    const expectedLength = (TestRegister.NbitLength / 4) + 2; // length for signature: Convert bit length to hex length and add 2 for '0x' prefix.
    validateHexString(signature, expectedLength);
  }
  
  /**
   * Validates a hexadecimal string.
   * @param hexStringObject - An object containing a hexadecimal string to be validated.
   * @param expectedLength - The expected length of the hexadecimal string.
   * @throws Will throw an error if the hexadecimal string is invalid or of incorrect length.
   */
  export function validateHexString(hexStringObject: { hexString: string }, expectedLength: number): void {
  
    if (hexStringObject.hexString.length !== expectedLength || !isValidHex(hexStringObject.hexString)) {
      throw new Error(`Invalid token format or length. Expected length: ${expectedLength} Token: ${hexStringObject.hexString}`);
    }
  }
  