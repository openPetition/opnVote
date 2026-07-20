/*** Public Constants ***/
import { bls12_381 } from '@noble/curves/bls12-381';
import { BlsParams } from './types/types';


// BLS register (test/demo Keys)
const TEST_REGISTER_SK = BigInt("0x2ee6af5a69b41ab314c4fc99ceae5ad81cb64cfe209b27642f570b4e7a841619");
export const TestRegister: BlsParams = {
    sk: TEST_REGISTER_SK,
    pk: '0x' + bls12_381.shortSignatures.getPublicKey(TEST_REGISTER_SK).toHex(false),
};
