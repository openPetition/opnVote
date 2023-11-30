"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
require('dotenv').config();
// Constants
if (!process.env.RPC_URL) {
    console.error("RPC not set!");
    process.exit(1);
}
const RPC_URL = process.env.RPC_URL;
const provider = new ethers_1.ethers.JsonRpcProvider(RPC_URL);
const BLOCK_RANGE = 300; // Gnosis chain: avg. 17280 Blocks/day
//Speed test for 17280 blocks and 0 transactions took 279.069 seconds.
function speedTest() {
    return __awaiter(this, void 0, void 0, function* () {
        // Fetch the most recent block number
        const newestBlockNumber = yield provider.getBlockNumber();
        let processedTransactions = 0;
        console.log(`Starting speed test for ${BLOCK_RANGE} blocks...`);
        const startTime = Date.now();
        for (let i = 0; i < BLOCK_RANGE; i++) {
            const blockNumber = newestBlockNumber - i;
            const block = yield provider.getBlock(blockNumber);
            if (block && block.transactions.length > 0) {
                yield block.getTransaction(block.transactions[0]);
                const randomTxIndex = Math.floor(Math.random() * block.transactions.length);
                yield provider.getTransactionReceipt(block.transactions[randomTxIndex]);
                processedTransactions++;
            }
            if ((i + 1) % 100 === 0) {
                console.log(`${i + 1} blocks and ${processedTransactions} transactions processed.`);
            }
        }
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000; // Convert to seconds
        console.log(`Speed test for ${BLOCK_RANGE} blocks and ${processedTransactions} transactions took ${duration} seconds.`);
    });
}
speedTest();
