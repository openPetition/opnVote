import { CallWithERC2771Request, GelatoRelay} from "@gelatonetwork/relay-sdk";
import dotenv from "dotenv"
import { ethers } from "ethers5";
dotenv.config()
const provider = new ethers.providers.JsonRpcProvider(process.env['GETH_RPC'])
const gelatoKey: string = process.env['GELATO_SPONSOR_KEY']!
const randWallet = new ethers.Wallet(ethers.Wallet.createRandom(provider).privateKey, provider);
const contractAddress = "0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc"
const relay = new GelatoRelay();
const iface = new ethers.utils.Interface([
  "function allowlistSize()"
]);

const callData = iface.encodeFunctionData("allowlistSize")
async function main() {

  const network = await provider.getNetwork()

  const relayRequest: CallWithERC2771Request = {
    chainId: network.chainId,
    target: contractAddress,
    data: callData,
    user: randWallet.address
  };
  console.log("Sending Transaction: Signer: " + await randWallet.getAddress())
  const relayResponse = await relay.sponsoredCallERC2771(relayRequest, randWallet, gelatoKey);
  console.log(relayResponse)
}

main()
