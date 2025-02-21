// encryption:
// import * as crypto from "crypto";
// import { ec as EC } from "elliptic";

// // Initialize elliptic curve
// const ec = new EC("secp256k1");

// function encryptMessage(message: string, publicKeyHex: string): string {
//     // Generate ephemeral keypair
//     const ephemeralKeyPair = ec.genKeyPair();
//     const ephemeralPublicKey = ephemeralKeyPair.getPublic();
    
//     // Get public key point from hex
//     const publicKey = ec.keyFromPublic(publicKeyHex, 'hex').getPublic();
    
//     // Generate shared secret
//     const sharedSecret = ephemeralKeyPair.derive(publicKey);
    
//     // Create hash of shared secret for encryption key
//     const hash = crypto.createHash('sha512').update(sharedSecret.toString(16)).digest();
//     const encryptionKey = hash.slice(0, 32);
//     const macKey = hash.slice(32);
    
//     // Encrypt message
//     const iv = crypto.randomBytes(16);
//     const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
//     let encrypted = cipher.update(message, 'utf8', 'hex');
//     encrypted += cipher.final('hex');
    
//     // Combine elements
//     const ephemeralPublicKeyHex = ephemeralPublicKey.encode('hex', true);
//     const ivHex = iv.toString('hex');
    
//     // Return combined data
//     return JSON.stringify({
//         encrypted,
//         ephemPublicKey: ephemeralPublicKeyHex,
//         iv: ivHex
//     });
// }
// function decryptMessage(encryptedData: string, privateKeyHex: string): string {
//     const { encrypted, ephemPublicKey, iv } = JSON.parse(encryptedData);
    
//     // Get private key object
//     const privateKey = ec.keyFromPrivate(privateKeyHex);
    
//     // Get ephemeral public key point
//     const ephemeralPublicKey = ec.keyFromPublic(ephemPublicKey, 'hex').getPublic();
    
//     // Generate shared secret
//     const sharedSecret = privateKey.derive(ephemeralPublicKey);
    
//     // Create hash of shared secret for encryption key
//     const hash = crypto.createHash('sha512').update(sharedSecret.toString(16)).digest();
//     const encryptionKey = hash.slice(0, 32);
    
//     // Decrypt message
//     const decipher = crypto.createDecipheriv(
//         'aes-256-cbc', 
//         encryptionKey, 
//         Buffer.from(iv, 'hex')
//     );
//     let decrypted = decipher.update(encrypted, 'hex', 'utf8');
//     decrypted += decipher.final('utf8');
    
//     return decrypted;
// }

// Example usage
// function main() {
//     // Generate a key pair
//     const keyPair = ec.genKeyPair();
//     const privateKeyHex = keyPair.getPrivate('hex');
//     const publicKeyHex = keyPair.getPublic('hex');
    
//     // Test message
//     const message = "Hello, this is a secret message!";
//     console.log('Original Message:', message);
    
//     // Encrypt
//     const encrypted = encryptMessage(message, publicKeyHex);
//     console.log('Encrypted:', encrypted);
    
//     // Decrypt
//     const decrypted = decryptMessage(encrypted, privateKeyHex);
//     console.log('Decrypted:', decrypted);
// }

// main();






import { ec as EC } from "elliptic";
import crypto from "crypto";
import BN from "bn.js";
import { ethers } from "ethers";
// Initialize the elliptic curve (secp256k1)
const ec = new EC("secp256k1");

// Helper function to hash data using SHA256
function sha256(data: Buffer): Buffer {
    return crypto.createHash("sha256").update(data).digest();
}

// Key Generation
function generateKeyPair() {
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate(); // BN instance
    const publicKey = keyPair.getPublic(); // EC Point
    return { privateKey, publicKey };
}

// Blind the message
function blind(message: BN) {
    const alpha = ec.genKeyPair().getPrivate();

    // Calculate commitment R = alpha * G
    const R = ec.g.mul(alpha);
    const R_x = R.getX(); // Extract x-coordinate
    const R_y = R.getY(); // Extract y-coordinate

    // Calculate challenge e = H(m || R_x || R_y)
    const messageBuffer = message.toArrayLike(Buffer, 'be', 32); // Convert BN to 32-byte buffer
    const R_xBuffer = R_x.toArrayLike(Buffer, 'be', 32); // Convert BN to 32-byte buffer
    const R_yBuffer = R_y.toArrayLike(Buffer, 'be', 32); // Convert BN to 32-byte buffer

    const e = new BN(
        sha256(Buffer.concat([messageBuffer, R_xBuffer, R_yBuffer])).toString('hex'),
        16
    );

    // Calculate blinded challenge: e' = e * alpha^-1 mod n
    const alphaInv = alpha.invm(ec.curve.n);
    const blindedChallenge = e.mul(alphaInv).umod(ec.curve.n);

    return { blindedChallenge, alpha, R, R_x, R_y, e };
}

// Signing Function (for signer)
function sign(blindedChallenge: BN, privateKey: BN) {
    // s' = x * e' mod n (where x is private key)
    return privateKey.mul(blindedChallenge).umod(ec.curve.n);
}

// Unblinding Function (for user)
function unblind(blindedSignature: BN, alpha: BN) {
    // s = s' * alpha mod n
    return blindedSignature.mul(alpha).umod(ec.curve.n);
}

// Verification Function
function verify(message: BN, signature: BN, R_x: BN, R_y: BN, publicKey: any) {
    // Calculate challenge e = H(m || R_x || R_y)
     const messageBuffer = message.toArrayLike(Buffer, 'be', 32); // Convert BN to 32-byte buffer
     const R_xBuffer = R_x.toArrayLike(Buffer, 'be', 32); // Convert BN to 32-byte buffer
     const R_yBuffer = R_y.toArrayLike(Buffer, 'be', 32); // Convert BN to 32-byte buffer
 
     const e = new BN(
         sha256(Buffer.concat([messageBuffer, R_xBuffer, R_yBuffer])).toString('hex'),
         16
     );
 
     console.log("e", e.toString(16));
 
     // Verify: sG = eP
     const sG = ec.g.mul(signature);
     const sG_x = sG.getX();  // Get x coordinate as BN
     const sG_y = sG.getY();  // Get y coordinate as BN
     
     // If you need the hex representation:
     console.log("sG x coordinate:", sG_x.toString(16));
     console.log("sG y coordinate:", sG_y.toString(16));
     
     const eP = publicKey.mul(e);
 
     return sG.eq(eP);
}
function prepareMessageForBlindSigning(ethAddress: string): BN {
    // Validate address format

    // Process the address
    const message = processMessage(ethAddress);

    // Validate the resulting value
    validateMessageSize(message);

    return message;
}
function validateMessageSize(message: BN) {
    if (message.gte(ec.curve.n)) {
        throw new Error("Message too large");
    }
    if (message.isZero()) {
        throw new Error("Message cannot be zero");
    }
}
function processMessage(ethAddress: string): BN {
    // Remove '0x' prefix if present
    const cleanAddress = ethAddress.replace('0x', '');
    
    // Hash the address
    const hash = sha256(Buffer.from(cleanAddress, 'hex'));
    
    // Convert to BN and reduce modulo curve order
    return new BN(hash.toString('hex'), 16).umod(ec.curve.n);
}
// Main Execution
function main() {
    const keyPair = ec.genKeyPair();
    const privateKeyHex = keyPair.getPrivate('hex');
    const publicKeyHex = keyPair.getPublic('hex');
    

    // Generate key pair for signer
    const { privateKey, publicKey } = generateKeyPair();
    console.log("Signer's Private Key (hex):", privateKey.toString(16));
    console.log("Signer's Public Key (hex):", publicKey.encode('hex', true));
    const ethAddress = ethers.Wallet.createRandom().address;
    const messageForSigning = prepareMessageForBlindSigning(ethAddress);
    const startBlinding = performance.now();
    const { blindedChallenge, alpha, R, R_x, R_y, e } = blind(messageForSigning);
    const endBlinding = performance.now();
    const clientTimeBlinding = endBlinding - startBlinding;
    const blindedSignature = sign(blindedChallenge, privateKey);
    const startUnblinding = performance.now();

    const signature = unblind(blindedSignature, alpha);
    const encrypted = encryptMessage("1", publicKeyHex);
    const endUnblinding = performance.now();
    const clientTimeUnblinding = endUnblinding - startUnblinding;
    console.log("Client Time for Unblinding:", clientTimeUnblinding);   
    console.log("Client Time for Blinding:", clientTimeBlinding);
    console.log("Encrypted:", encrypted);

    // Anyone: Verify the signature
    const isValid = verify(messageForSigning, signature, R_x, R_y, publicKey);
    console.log("\nSignature Valid:", isValid);
}

main();


async function scalarMul(x: string, y: string, scalar: string) {
    // Ensure all inputs have 0x prefix
    const xHex = x.startsWith('0x') ? x : '0x' + x;
    const yHex = y.startsWith('0x') ? y : '0x' + y;
    const scalarHex = scalar.startsWith('0x') ? scalar : '0x' + scalar;

    // Prepare input for the precompile
    const input = ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(xHex), 32),
        ethers.zeroPadValue(ethers.toBeHex(yHex), 32),
        ethers.zeroPadValue(ethers.toBeHex(scalarHex), 32)
    ]);

    // Call precompile 0x07 using ethers
    const provider = new ethers.JsonRpcProvider(); // Use appropriate provider
    const data = await provider.call({
        to: "0x0000000000000000000000000000000000000007",
        data: input
    });

    // Parse result
    const resultX = BigInt(data.slice(0, 66));
    const resultY = BigInt("0x" + data.slice(66, 130));

    return { resultX, resultY };
}


function encryptMessage(message: string, publicKeyHex: string): string {
    // Generate ephemeral keypair
    const ephemeralKeyPair = ec.genKeyPair();
    const ephemeralPublicKey = ephemeralKeyPair.getPublic();
    
    // Get public key point from hex
    const publicKey = ec.keyFromPublic(publicKeyHex, 'hex').getPublic();
    
    // Generate shared secret
    const sharedSecret = ephemeralKeyPair.derive(publicKey);
    
    // Create hash of shared secret for encryption key
    const hash = crypto.createHash('sha512').update(sharedSecret.toString(16)).digest();
    const encryptionKey = hash.slice(0, 32);
    const macKey = hash.slice(32);
    
    // Encrypt message
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine elements
    const ephemeralPublicKeyHex = ephemeralPublicKey.encode('hex', true);
    const ivHex = iv.toString('hex');
    
    // Return combined data
    return JSON.stringify({
        encrypted,
        ephemPublicKey: ephemeralPublicKeyHex,
        iv: ivHex
    });
}