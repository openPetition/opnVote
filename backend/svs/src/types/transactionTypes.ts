//todo: add jsdoc
export enum TransactionStatus {
    WAITING = 'waiting',        // In local queue, waiting to be forwarded to Gelato
    PENDING = 'pending',        // Sent to Gelato, waiting for on-chain confirmation
    CONFIRMED = 'confirmed',    // Successfully written to the blockchain
    FAILED = 'failed',          // Transaction failed (either locally or on-chain) or cancelled
}