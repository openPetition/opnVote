import { ethers } from "ethers";

export const WALLET_THRESHOLDS = {
  MINIMUM_BALANCE: ethers.parseEther('0.0005'),
  LOW_BALANCE: ethers.parseEther('0.001'),
};

export const TX_LIMITS = {
  MAX_FEE_PER_GAS_SANITY_CHECK: ethers.parseUnits('100000000000', 'gwei'),
  MAX_PRIORITY_FEE_PER_GAS_SANITY_CHECK: ethers.parseUnits('100000000000', 'gwei'),
  DEFAULT_TX_TIMEOUT: 30000,
};

export const TX_MULTIPLIERS = {
  MAX_FEE_PERCENTAGE: 120n,
  MAX_PRIORITY_FEE_PERCENTAGE: 120n,
  GAS_LIMIT_PERCENTAGE: 120n
};
