export const GAS_DEFAULTS = {
  callGasLimit: 350_000n, // vote()
  verificationGasLimit: 110_000n, // smart account validateUserOp
  paymasterVerificationGasLimit: 80_000n, // paymaster validatePaymasterUserOp
  paymasterPostOpGasLimit: 1n, // no postOp logic
  preVerificationGas: 200_000n, // bundler overhead
}
