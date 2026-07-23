export const GAS_DEFAULTS = {
  callGasLimit: 500_000n, // vote()
  verificationGasLimit: 200_000n, // smart account validateUserOp
  paymasterVerificationGasLimit: 500_000n, // canVote() check
  paymasterPostOpGasLimit: 60_000n, // emit SponsoredVotePostOp
  preVerificationGas: 250_000n, // bundler overhead
}
