export enum GelatoQueueStatus {
  QUEUED = 'QUEUED', // The transaction has been added to the SVS queue but not yet processed
  PROCESSING = 'PROCESSING', // The transaction is currently being processed by SVS
  SUBMITTED = 'SUBMITTED', // The transaction has been successfully submitted to Gelato
  CONFIRMED = 'CONFIRMED', // The transaction has been confirmed on the blockchain
  FAILED = 'FAILED', // The transaction has failed after maximum retries or due to a Gelato/Blockchain error
  RETRY = 'RETRY', // Sending the transaction to Gelato failed, will be retried later
}
