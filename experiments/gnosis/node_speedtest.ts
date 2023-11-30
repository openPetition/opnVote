import { ethers } from 'ethers';
require('dotenv').config()


// Constants
if(!process.env.RPC_URL){
    console.error("RPC not set!")
    process.exit(1)
}

const RPC_URL = process.env.RPC_URL;
const provider = new ethers.JsonRpcProvider(RPC_URL)
const BLOCK_RANGE = 300 // Gnosis chain: avg. 17280 Blocks/day

//Speed test for 17280 blocks and 0 transactions took 279.069 seconds.
async function speedTest() {

    // Fetch the most recent block number
    const newestBlockNumber = await provider.getBlockNumber();
  
    let processedTransactions = 0;
    console.log(`Starting speed test for ${BLOCK_RANGE} blocks...`);
    const startTime = Date.now();

    for (let i = 0; i < BLOCK_RANGE; i++) {
        const blockNumber = newestBlockNumber - i;
        const block = await provider.getBlock(blockNumber);
        if (block && block.transactions.length > 0) {
            await block.getTransaction(block.transactions[0])

            const randomTxIndex = Math.floor(Math.random() * block.transactions.length);
            await provider.getTransactionReceipt(block.transactions[randomTxIndex])
            processedTransactions++
        }
        if ((i + 1) % 100 === 0) {
            console.log(`${i + 1} blocks and ${processedTransactions} transactions processed.`);
        }
    }
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    console.log(`Speed test for ${BLOCK_RANGE} blocks and ${processedTransactions} transactions took ${duration} seconds.`);

}
speedTest()
