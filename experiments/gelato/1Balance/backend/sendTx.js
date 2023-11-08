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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const relay_sdk_1 = require("@gelatonetwork/relay-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
const ethers5_1 = require("ethers5");
dotenv_1.default.config();
const provider = new ethers5_1.ethers.providers.JsonRpcProvider(process.env['GETH_RPC']);
const gelatoKey = process.env['GELATO_SPONSOR_KEY'];
const randWallet = new ethers5_1.ethers.Wallet(ethers5_1.ethers.Wallet.createRandom(provider).privateKey, provider);
const contractAddress = "0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc";
const relay = new relay_sdk_1.GelatoRelay();
const iface = new ethers5_1.ethers.utils.Interface([
    "function allowlistSize()"
]);
const callData = iface.encodeFunctionData("allowlistSize");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const network = yield provider.getNetwork();
        const relayRequest = {
            chainId: network.chainId,
            target: contractAddress,
            data: callData,
            user: randWallet.address
        };
        console.log("Sending Transaction: Signer: " + (yield randWallet.getAddress()));
        const relayResponse = yield relay.sponsoredCallERC2771(relayRequest, randWallet, gelatoKey);
        console.log(relayResponse);
    });
}
main();
