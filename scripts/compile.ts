/**
 * compile.ts - compile the Solidity contracts with solc and regenerate the
 * committed TypeScript artifacts (`contracts/*.artifact.ts`) in the same
 * shape as the scaffold's Counter artifact: an ABI const + creation bytecode.
 *
 * Usage: `npm run compile`
 *
 * Requires the `solc` devDependency (0.8.24). Artifacts are committed so
 * `npm run deploy` works without a Solidity toolchain on the deploy machine.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import solc from "solc";

const CONTRACTS_DIR = new URL("../contracts/", import.meta.url).pathname;

interface SolcOutput {
  errors?: { severity: string; formattedMessage: string }[];
  contracts?: Record<
    string,
    Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>
  >;
}

function lowerFirst(s: string): string {
  // Lowercase a leading run of capitals, keeping the last capital when it
  // starts a new word: PQCCertificate -> pqcCertificate,
  // PQCVerifier -> pqcVerifier, MockPQCVerifier -> mockPQCVerifier.
  return s.replace(/^[A-Z]+(?=[A-Z][a-z])|^[A-Z]+/, (run) =>
    run.toLowerCase(),
  );
}

function main(): void {
  const files = readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith(".sol"));
  const sources: Record<string, { content: string }> = {};
  for (const file of files) {
    sources[file] = {
      content: readFileSync(join(CONTRACTS_DIR, file), "utf8"),
    };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const errors = (output.errors ?? []).filter((e) => e.severity === "error");
  for (const e of output.errors ?? []) {
    console.log(e.formattedMessage);
  }
  if (errors.length > 0) {
    throw new Error(`solc failed with ${errors.length} error(s).`);
  }

  for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
    for (const [name, compiled] of Object.entries(contracts)) {
      // Interfaces have no bytecode; skip artifact generation for them.
      if (!compiled.evm.bytecode.object) continue;
      const abiName = `${lowerFirst(name)}Abi`;
      const binName = `${lowerFirst(name)}Bytecode`;
      const testOnly =
        name === "MockPQCVerifier"
          ? " * TEST-ONLY contract. Never deploy this as the certificate verifier on testnet/mainnet.\n"
          : "";
      const content = `/**
 * Compiled artifact for \`contracts/${file}\` (\`${name}\`).
 *${testOnly} * Generated with solc 0.8.24 (\`--optimize\`). Regenerate with
 * \`npm run compile\` after editing the contract.
 */
import type { Hex } from "viem";

export const ${abiName} = ${JSON.stringify(compiled.abi)} as const;

export const ${binName} = "0x${compiled.evm.bytecode.object}" as Hex;
`;
      writeFileSync(join(CONTRACTS_DIR, `${name}.artifact.ts`), content);
      console.log(`wrote contracts/${name}.artifact.ts`);
    }
  }
  console.log("Done.");
}

main();
