import { CallWithERC2771Request, GelatoRelay} from "@gelatonetwork/relay-sdk";
import dotenv from "dotenv"
import { ethers } from "ethers5";
dotenv.config()
const provider = new ethers.providers.JsonRpcProvider(process.env['GETH_RPC'])
const gelatoKey: string = process.env['GELATO_SPONSOR_KEY']!
const randWallet = new ethers.Wallet(ethers.Wallet.createRandom(provider).privateKey, provider);
const counterContractAddress = "0xA1DcB0486cA2c07d27237Ab7E349308694Bcc45B"
const relay = new GelatoRelay();
const iface = new ethers.utils.Interface([
  "function increment()"
]);

const callData = iface.encodeFunctionData("increment")
async function main() {

  const network = await provider.getNetwork()

  const relayRequest: CallWithERC2771Request = {
    chainId: network.chainId,
    target: counterContractAddress,
    data: callData,
    user: randWallet.address
  };
  console.log("Sending Transaction: Signer: " + await randWallet.getAddress())
  const relayResponse = await relay.sponsoredCallERC2771(relayRequest, randWallet, gelatoKey);
  console.log(relayResponse)
}

main()
