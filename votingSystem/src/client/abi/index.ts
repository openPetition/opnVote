import { ethers } from "ethers";
import opnvoteAbi from "./opnvote-0.4.0.json";
import paymasterAbi from "./paymaster-0.2.0.json";

export const OPNVOTE_ABI: ethers.InterfaceAbi = opnvoteAbi as ethers.InterfaceAbi;
export const PAYMASTER_ABI: ethers.InterfaceAbi = paymasterAbi as ethers.InterfaceAbi;
