import { ethers } from "ethers";
import { logger } from "./lib/logger";

const ETH_RPC_URL = process.env["ETH_RPC_URL"] || "https://cloudflare-eth.com";
const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);

export interface EthereumWallet {
  address: string;
  privateKey: string;
  label: string;
  balance: string;
}

export function generateEthereumWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

export async function getEthBalance(address: string): Promise<string> {
  try {
    const wei = await provider.getBalance(address);
    return Number(ethers.formatEther(wei)).toFixed(6);
  } catch (e) {
    logger.warn({ e }, "getEthBalance error");
    return "0.000000";
  }
}

export function isValidEthereumAddress(address: string): boolean {
  return ethers.isAddress(address);
}
