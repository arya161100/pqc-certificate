/**
 * qore.ts - viem wiring for the PQC Certificate frontend.
 *
 * Testnet only (qorechain-diana, EVM chain id 9800). No real funds, no
 * mainnet. The wallet is the user's own QoreX (or any injected EIP-1193
 * wallet); this code never asks for, reads, or stores a private key or
 * seed phrase.
 *
 * Note: the chain object is defined locally with viem's `defineChain`
 * (same values as the SDK's `qorechainTestnet`) so the app compiles against
 * its own viem version. The PQC precompile ABIs/addresses come from
 * `@qorechain/evm` as plain data.
 */
import { IQORE_PQC_ABI, PRECOMPILE_ADDRESSES } from "@qorechain/evm";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  encodePacked,
  http,
  keccak256,
  type Address,
  type EIP1193Provider,
  type Hash,
  type Hex,
  type WalletClient,
} from "viem";

import { pqcCertificateAbi } from "../../../contracts/PQCCertificate.artifact.js";

export const CHAIN = defineChain({
  id: 9800,
  name: "QoreChain Testnet",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evm-testnet.qore.host"] },
  },
  blockExplorers: {
    default: { name: "QoreChain Explorer", url: "https://explore.qore.network" },
  },
});

export const EXPLORER = "https://explore.qore.network";

/** Deployed contract addresses — set in app/.env (see .env.example). */
export const CERTIFICATE_ADDRESS = (
  import.meta.env.VITE_CERTIFICATE_ADDRESS as string | undefined
)?.trim() as Address | undefined;
export const VERIFIER_ADDRESS = (
  import.meta.env.VITE_VERIFIER_ADDRESS as string | undefined
)?.trim() as Address | undefined;

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(),
});

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && "ethereum" in window;
}

export async function connectWallet(): Promise<{
  account: Address;
  wallet: WalletClient;
}> {
  if (!hasInjectedWallet()) {
    throw new Error(
      "No injected wallet found. Install QoreX (or another EIP-1193 wallet) and try again.",
    );
  }
  const provider = (window as unknown as { ethereum: EIP1193Provider })
    .ethereum;
  const wallet = createWalletClient({
    chain: CHAIN,
    transport: custom(provider),
  });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("Wallet returned no accounts.");

  // Make sure the wallet is on QoreChain testnet (chain id 9800).
  const chainId = await wallet.getChainId();
  if (chainId !== CHAIN.id) {
    try {
      await wallet.switchChain({ id: CHAIN.id });
    } catch {
      await wallet.addChain({ chain: CHAIN });
      await wallet.switchChain({ id: CHAIN.id });
    }
  }
  return { account, wallet };
}

/** keccak256 of a file's raw bytes — the document hash stored on-chain. */
export async function hashFile(file: File): Promise<Hash> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return keccak256(bytes);
}

export async function issueCertificate(
  wallet: WalletClient,
  account: Address,
  documentHash: Hash,
  title: string,
  recipient: string,
): Promise<Hash> {
  if (!CERTIFICATE_ADDRESS) {
    throw new Error(
      "Contract address is not configured. Set VITE_CERTIFICATE_ADDRESS in app/.env (see DEPLOY.md).",
    );
  }
  return wallet.writeContract({
    address: CERTIFICATE_ADDRESS,
    abi: pqcCertificateAbi,
    functionName: "issueCertificate",
    args: [documentHash, title, recipient],
    account,
    chain: CHAIN,
  });
}

export interface CertificateData {
  issuer: Address;
  title: string;
  recipient: string;
  documentHash: Hash;
  issuedAt: bigint;
  pqVerified: boolean;
  revoked: boolean;
}

export async function verifyCertificate(
  issuer: Address,
  documentHash: Hash,
): Promise<{ valid: boolean; cert: CertificateData | null; id: bigint }> {
  if (!CERTIFICATE_ADDRESS) {
    throw new Error(
      "Contract address is not configured. Set VITE_CERTIFICATE_ADDRESS in app/.env (see DEPLOY.md).",
    );
  }
  const [valid, cert] = await publicClient.readContract({
    address: CERTIFICATE_ADDRESS,
    abi: pqcCertificateAbi,
    functionName: "verifyCertificate",
    args: [issuer, documentHash],
  });
  // The registry keys certificates by keccak256(issuer, documentHash).
  const key = keccak256(
    encodePacked(["address", "bytes32"], [issuer, documentHash]),
  );
  const id = await publicClient.readContract({
    address: CERTIFICATE_ADDRESS,
    abi: pqcCertificateAbi,
    functionName: "certificateIdOf",
    args: [key],
  });
  return {
    valid,
    cert:
      cert.issuer === "0x0000000000000000000000000000000000000000"
        ? null
        : (cert as CertificateData),
    id,
  };
}

/** On-chain ML-DSA key registration status (precompile 0x0a02). */
export async function getPqKeyStatus(account: Address): Promise<{
  registered: boolean;
  algorithmId: number;
  pubkey: Hex;
}> {
  const [registered, algorithmId, pubkey] = await publicClient.readContract({
    address: PRECOMPILE_ADDRESSES.pqcKeyStatus,
    abi: IQORE_PQC_ABI,
    functionName: "pqcKeyStatus",
    args: [account],
  });
  return { registered, algorithmId, pubkey };
}

export function explorerTxUrl(hash: Hash): string {
  return `${EXPLORER}/tx/${hash}`;
}
