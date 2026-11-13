/**
 * deploy.ts - deploy PQCVerifier + PQCCertificate to the QoreChain EVM
 * Engine and exercise them: read the count, issue one demo certificate,
 * and read it back.
 *
 * Uses @qorechain/evm (createEvmClient / deployContract / readContract /
 * writeContract) and viem.
 *
 * Requirements (see README / DEPLOY.md):
 *   - QORE_EVM_RPC_URL pointing at a reachable QoreChain EVM JSON-RPC
 *     endpoint. Defaults to http://localhost:8545 (local dev chain).
 *   - QORE_EVM_PRIVATE_KEY for a funded EVM account (0x-prefixed, 32 bytes).
 *     NEVER commit a real key. On testnet this must be the EVM account of
 *     the wallet that will own the certificates (QoreX "Add an Ethereum
 *     account (coin 60)").
 *   - On QoreChain testnet (chain id 9800) the account ALSO needs a live
 *     EVM authorisation window before any transaction is accepted. Open it
 *     first (QoreX does this automatically, or `qorechaind tx pqc
 *     open-evm-window ...`); opening a window advances the nonce, so deploy
 *     only after the window transaction lands.
 *
 * SAFETY: this script REFUSES to run on mainnet (chain id 9801). This
 * project is testnet-only. It also refuses the placeholder private key.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createEvmClient,
  deployContract,
  evmAccountFromPrivateKey,
  readContract,
  writeContract,
} from "@qorechain/evm";
import type { Address, Hex } from "viem";
import { keccak256, stringToHex } from "viem";

import {
  pqcCertificateAbi,
  pqcCertificateBytecode,
} from "../contracts/PQCCertificate.artifact.js";
import {
  pqcVerifierAbi,
  pqcVerifierBytecode,
} from "../contracts/PQCVerifier.artifact.js";

const ZERO_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const evmRpc = process.env.QORE_EVM_RPC_URL ?? "http://localhost:8545";
  const privateKey = requireEnv("QORE_EVM_PRIVATE_KEY") as Hex;
  if (privateKey.toLowerCase() === ZERO_KEY) {
    throw new Error(
      "QORE_EVM_PRIVATE_KEY is still the placeholder. Set a real funded key in .env (never commit it).",
    );
  }

  const client = await createEvmClient({ endpoints: { evmRpc } });
  const chainId = await client.getChainId();
  if (chainId === 9801) {
    throw new Error(
      "Refusing to deploy to mainnet (chain id 9801). This project is testnet-only (9800) or local.",
    );
  }
  const account = evmAccountFromPrivateKey(privateKey);
  const wallet = client.getWalletClient(account);

  console.log(`network:  chain id ${chainId} (${evmRpc})`);
  console.log(`deployer: ${account.address}`);
  if (chainId === 9800) {
    console.log(
      "NOTE: on testnet the deployer needs a live EVM authorisation window.\n" +
        "      Open it first (QoreX, or `qorechaind tx pqc open-evm-window`), then deploy.",
    );
  }

  // 1. Deploy the real PQ verifier (forwards to precompile 0x0a01).
  console.log("\nDeploying PQCVerifier…");
  const verifierHash = await deployContract(wallet, {
    abi: pqcVerifierAbi,
    bytecode: pqcVerifierBytecode,
    args: [],
  });
  const verifierReceipt =
    await client.publicClient.waitForTransactionReceipt({
      hash: verifierHash,
    });
  const verifier = verifierReceipt.contractAddress as Address;
  console.log(`PQCVerifier:      ${verifier} (tx ${verifierHash})`);

  // 2. Deploy the certificate registry, wired to the real verifier.
  console.log("\nDeploying PQCCertificate…");
  const certHash = await deployContract(wallet, {
    abi: pqcCertificateAbi,
    bytecode: pqcCertificateBytecode,
    args: [verifier],
  });
  const certReceipt = await client.publicClient.waitForTransactionReceipt({
    hash: certHash,
  });
  const certificate = certReceipt.contractAddress as Address;
  console.log(`PQCCertificate:   ${certificate} (tx ${certHash})`);

  // 3. Exercise it: issue one demo certificate, then read it back.
  const demoHash = keccak256(stringToHex("PQC Certificate demo"));
  console.log(`\nIssuing demo certificate (documentHash ${demoHash})…`);
  const issueHash = await writeContract(wallet, {
    address: certificate,
    abi: pqcCertificateAbi,
    functionName: "issueCertificate",
    args: [demoHash, "PQC Certificate — Demo", "Demo Recipient"],
    account: wallet.account ?? null,
    chain: wallet.chain,
  });
  await client.publicClient.waitForTransactionReceipt({ hash: issueHash });
  console.log(`issue tx:         ${issueHash}`);

  const count = await readContract(client.publicClient, {
    address: certificate,
    abi: pqcCertificateAbi,
    functionName: "certificateCount",
  });
  const [valid, cert] = (await readContract(client.publicClient, {
    address: certificate,
    abi: pqcCertificateAbi,
    functionName: "verifyCertificate",
    args: [account.address, demoHash],
  })) as [
    boolean,
    { title: string; recipient: string; pqVerified: boolean },
  ];
  console.log(`certificateCount: ${count}`);
  console.log(
    `verifyCertificate: valid=${valid} title="${cert.title}" recipient="${cert.recipient}" pqVerified=${cert.pqVerified}`,
  );

  // 4. Save the deployment for the frontend + submission docs.
  const deployment = {
    network: chainId === 9800 ? "qorechain-diana" : `chain-${chainId}`,
    chainId,
    rpc: evmRpc,
    deployer: account.address,
    contracts: {
      PQCVerifier: { address: verifier, tx: verifierHash },
      PQCCertificate: { address: certificate, tx: certHash },
    },
    demoCertificate: { documentHash: demoHash, issueTx: issueHash },
    deployedAt: new Date().toISOString(),
  };
  const dir = new URL("../deployments/", import.meta.url).pathname;
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${deployment.network}-${chainId}.json`);
  writeFileSync(outPath, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`\nDeployment saved to ${outPath}`);
  console.log("\nDone.");
}

main().catch((err: unknown) => {
  console.error("\nDeploy failed.");
  console.error(
    "Check QORE_EVM_RPC_URL is reachable, QORE_EVM_PRIVATE_KEY funds an account, " +
      "and (on testnet) the account has a live EVM authorisation window.",
  );
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
