import { ethers } from 'ethers'

const EIP7702_MARKER = '0x7702000000000000000000000000000000000000'

const USER_OP_TYPES = {
  PackedUserOperation: [
    { name: 'sender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'initCode', type: 'bytes' },
    { name: 'callData', type: 'bytes' },
    { name: 'accountGasLimits', type: 'bytes32' },
    { name: 'preVerificationGas', type: 'uint256' },
    { name: 'gasFees', type: 'bytes32' },
    { name: 'paymasterAndData', type: 'bytes' },
  ],
}

function uint128(value: any): string {
  return ethers.toBeHex(value ?? 0, 16)
}

function getInitCode(userOp: Record<string, any>): string | null {
  if (!userOp.factory) return '0x'
  const factory = String(userOp.factory).toLowerCase()
  if (factory !== '0x7702' && factory !== EIP7702_MARKER) {
    return ethers.concat([userOp.factory, userOp.factoryData ?? '0x'])
  }
  if (!userOp.eip7702Auth?.address) return null
  return ethers.concat([userOp.eip7702Auth.address, userOp.factoryData ?? '0x'])
}

/**
 * Computes entrypoint v0.8 userOpHash
 * @returns user op Hash or null if hash cannot be computed
 */
export function calcUserOpHash(
  userOp: Record<string, any>,
  entryPoint: string,
  chainId: number,
): string | null {
  try {
    const initCode = getInitCode(userOp)
    if (initCode === null) return null

    const paymasterAndData = userOp.paymaster
      ? ethers.concat([
          userOp.paymaster,
          uint128(userOp.paymasterVerificationGasLimit),
          uint128(userOp.paymasterPostOpGasLimit),
          userOp.paymasterData ?? '0x',
        ])
      : '0x'
    const domain = { name: 'ERC4337', version: '1', chainId, verifyingContract: entryPoint }

    return ethers.TypedDataEncoder.hash(domain, USER_OP_TYPES, {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode,
      callData: userOp.callData,
      accountGasLimits: ethers.concat([uint128(userOp.verificationGasLimit), uint128(userOp.callGasLimit)]),
      preVerificationGas: userOp.preVerificationGas ?? 0,
      gasFees: ethers.concat([uint128(userOp.maxPriorityFeePerGas), uint128(userOp.maxFeePerGas)]),
      paymasterAndData,
    })

  } catch {
    return null //user op hash couldnt be computed
  }
}


export function isSignedBySender(userOp: Record<string, any>, userOpHash: string): boolean {
  try {
    return ethers.recoverAddress(userOpHash, userOp.signature).toLowerCase() === String(userOp.sender).toLowerCase()
  } catch {
    return false
  }
}
