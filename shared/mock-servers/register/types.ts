/**
 * Represents a signed Message
 * @property {string} hexString - The value of r, encoded as a hexadecimal string (must be "0x" prefixed).
 * @property {boolean} isBlinded - Indicates if the signature is blinded or unblinded. 
 */
export type Signature = {
    hexString: string;
    isBlinded: Boolean;
  };
  

  /**
 * Represents a Token
 * @property {string} hexValue - The token value, encoded as a hexadecimal string (must be "0x" prefixed).
 * @property {boolean} isMaster - Indicates if the token is a master token. 
 * @property {boolean} isBlinded - Indicates if the token is blinded or unblinded. 
 * 
 */
export type Token = {
    hexString: string;
    isMaster: Boolean;
    isBlinded: Boolean
};
