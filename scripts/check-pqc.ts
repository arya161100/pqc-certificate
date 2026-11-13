/**
 * check-pqc.ts - read-only check of the QoreChain PQC precompiles on a
 * given EVM RPC endpoint. No wallet, no funds, no transactions.
 *
 * Usage:
 *   npx tsx scripts/check-pqc.ts [0xAddress ...]
 *
 * Defaults to the user's registered QoreX EVM address when no address is
 * given. Prints each account's on-chain ML-DSA key registration status
 * (pqcKeyStatus, precompile 0x0a02). If the precompile is inactive on the
 * endpoint, the read fails with an empty-returndata decode error — which
 * itself tells you the precompile is not active there.
 */
import { createEvmClient, pqcKeyStatus } from "@qorechain/evm";
import type { Address } from "viem";

const DEFAULT_ADDRESSES: Address[] = [
  "0x705d79bcfc308a60979f339fec8b8071e640b1b8", // user's QoreX EVM address
];

async function main(): Promise<void> {
  const evmRpc =
    process.env.QORE_EVM_RPC_URL ?? "https://evm-testnet.qore.host";
  const addresses = (process.argv.slice(2) as Address[]).length
    ? (process.argv.slice(2) as Address[])
    : DEFAULT_ADDRESSES;

  const client = await createEvmClient({ endpoints: { evmRpc } });
  console.log(`endpoint: ${evmRpc}`);
  console.log(`chain id: ${await client.getChainId()}`);

  for (const addr of addresses) {
    try {
      const s = await pqcKeyStatus(client.publicClient, addr);
      console.log(
        `${addr} => registered=${s.registered} algorithmId=${s.algorithmId} pubkey=${s.pubkey === "0x" ? "(none)" : s.pubkey.slice(0, 18) + "…"}`,
      );
    } catch (err) {
      console.log(
        `${addr} => ERROR (precompile likely inactive here): ${(err as Error).message.slice(0, 160)}`,
      );
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
