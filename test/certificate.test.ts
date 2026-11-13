/**
 * certificate.test.ts - end-to-end tests for PQCCertificate, PQCVerifier
 * and MockPQCVerifier against a local ganache chain (no wallet, no funds,
 * no network access beyond localhost).
 *
 * Usage: `npm test`
 *
 * Coverage:
 *  - plain issuance, field storage, uniqueness per (issuer, documentHash)
 *  - input validation (empty hash / title / recipient)
 *  - verifyCertificate (live, unknown, revoked)
 *  - revoke (issuer-only, double-revoke, missing id)
 *  - PQ-proof path via MockPQCVerifier (valid / invalid / unset / empty)
 *  - PQCVerifier graceful behaviour where the 0x0a01/0x0a02 precompiles do
 *    not exist (returns false / (false, 0, 0x) instead of reverting)
 */
import assert from "node:assert/strict";
import Ganache from "ganache";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEventLogs,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  mockPQCVerifierAbi,
  mockPQCVerifierBytecode,
} from "../contracts/MockPQCVerifier.artifact.js";
import {
  pqcCertificateAbi,
  pqcCertificateBytecode,
} from "../contracts/PQCCertificate.artifact.js";
import {
  pqcVerifierAbi,
  pqcVerifierBytecode,
} from "../contracts/PQCVerifier.artifact.js";

const LOCAL_CHAIN = {
  id: 1337,
  name: "Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
} as const;

const DOC = keccak256(stringToHex("PQC Certificate test document"));
const OTHER_DOC = keccak256(stringToHex("another document"));
const FAKE_SIG = "0x1234" as Hex;
const FAKE_PUBKEY = "0x5678" as Hex;

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : err}`);
  }
}

/** Expect a viem write to revert with a message containing `fragment`. */
async function expectRevert(
  p: Promise<unknown>,
  fragment: string,
): Promise<void> {
  try {
    await p;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert.ok(
      msg.includes(fragment),
      `expected revert containing "${fragment}", got: ${msg.slice(0, 300)}`,
    );
    return;
  }
  assert.fail(`expected revert containing "${fragment}", but call succeeded`);
}

async function main(): Promise<void> {
  const server = Ganache.server({
    wallet: { deterministic: true },
    chain: { chainId: 1337 },
    logging: { quiet: true },
  });
  await server.listen(8545);
  console.log("ganache listening on 127.0.0.1:8545");

  const initialAccounts = (
    server.provider as unknown as {
      getInitialAccounts(): Record<string, { secretKey: Hex; balance: string }>;
    }
  ).getInitialAccounts();
  const keys = Object.values(initialAccounts).map((a) => a.secretKey);
  const deployer = privateKeyToAccount(keys[0]);
  const stranger = privateKeyToAccount(keys[1]);

  const publicClient = createPublicClient({
    chain: LOCAL_CHAIN,
    transport: http(),
  });
  const wallet = createWalletClient({
    account: deployer,
    chain: LOCAL_CHAIN,
    transport: http(),
  });
  const strangerWallet = createWalletClient({
    account: stranger,
    chain: LOCAL_CHAIN,
    transport: http(),
  });

  async function deploy(
    abi: typeof pqcCertificateAbi,
    bytecode: Hex,
    args: unknown[],
    account = deployer,
  ): Promise<Address> {
    const hash = await createWalletClient({
      account,
      chain: LOCAL_CHAIN,
      transport: http(),
    }).deployContract({ abi, bytecode, args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.ok(receipt.contractAddress, "no contract address in receipt");
    return receipt.contractAddress;
  }

  console.log("\nDeploying contracts…");
  const mockVerifier = await deploy(
    mockPQCVerifierAbi,
    mockPQCVerifierBytecode,
    [],
  );
  const realVerifier = await deploy(pqcVerifierAbi, pqcVerifierBytecode, []);
  const certMock = await deploy(pqcCertificateAbi, pqcCertificateBytecode, [
    mockVerifier,
  ]);
  const certNoVerifier = await deploy(
    pqcCertificateAbi,
    pqcCertificateBytecode,
    ["0x0000000000000000000000000000000000000000"],
  );
  console.log(`  MockPQCVerifier:  ${mockVerifier}`);
  console.log(`  PQCVerifier:      ${realVerifier}`);
  console.log(`  PQCCertificate:   ${certMock} (mock verifier)`);
  console.log(`  PQCCertificate:   ${certNoVerifier} (no verifier)`);

  const read = (functionName: string, args: unknown[] = [], address = certMock) =>
    publicClient.readContract({
      address,
      abi: pqcCertificateAbi,
      functionName: functionName as never,
      args: args as never,
    }) as Promise<never>;
  const write = (
    functionName: string,
    args: unknown[],
    w = wallet,
    address = certMock,
  ) =>
    w.writeContract({
      address,
      abi: pqcCertificateAbi,
      functionName: functionName as never,
      args: args as never,
      account: w.account ?? null,
      chain: LOCAL_CHAIN,
    });

  console.log("\nRunning tests…");

  await test("issueCertificate stores fields and emits CertificateIssued", async () => {
    const hash = await write("issueCertificate", [
      DOC,
      "PQC Certificate — Test",
      "Alice",
    ]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: pqcCertificateAbi,
      logs: receipt.logs,
      eventName: "CertificateIssued",
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].args.id, 1n);
    assert.equal(logs[0].args.issuer?.toLowerCase(), deployer.address.toLowerCase());
    assert.equal(logs[0].args.pqVerified, false);

    const cert = (await read("getCertificate", [1n])) as {
      issuer: Address;
      title: string;
      recipient: string;
      documentHash: Hex;
      pqVerified: boolean;
      revoked: boolean;
    };
    assert.equal(cert.issuer.toLowerCase(), deployer.address.toLowerCase());
    assert.equal(cert.title, "PQC Certificate — Test");
    assert.equal(cert.recipient, "Alice");
    assert.equal(cert.documentHash, DOC);
    assert.equal(cert.pqVerified, false);
    assert.equal(cert.revoked, false);
    assert.equal(await read("certificateCount"), 1n);
  });

  await test("verifyCertificate returns valid for a live certificate", async () => {
    const [valid, cert] = (await read("verifyCertificate", [
      deployer.address,
      DOC,
    ])) as [boolean, { title: string }];
    assert.equal(valid, true);
    assert.equal(cert.title, "PQC Certificate — Test");
  });

  await test("verifyCertificate returns invalid for an unknown document", async () => {
    const [valid, cert] = (await read("verifyCertificate", [
      deployer.address,
      OTHER_DOC,
    ])) as [boolean, { issuer: Address }];
    assert.equal(valid, false);
    assert.equal(cert.issuer, "0x0000000000000000000000000000000000000000");
  });

  await test("duplicate certificate for same issuer+hash reverts", async () => {
    await expectRevert(
      write("issueCertificate", [DOC, "Again", "Bob"]).then((h) =>
        publicClient.waitForTransactionReceipt({ hash: h as Hex }),
      ),
      "already certified",
    );
  });

  await test("same document hash by a different issuer is allowed", async () => {
    const hash = await write(
      "issueCertificate",
      [DOC, "Stranger copy", "Carol"],
      strangerWallet,
    );
    await publicClient.waitForTransactionReceipt({ hash });
    const [valid] = (await read("verifyCertificate", [
      stranger.address,
      DOC,
    ])) as [boolean, unknown];
    assert.equal(valid, true);
    assert.equal(await read("certificateCount"), 2n);
  });

  await test("empty hash / title / recipient revert", async () => {
    const zero = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
    await expectRevert(
      write("issueCertificate", [zero, "T", "R"]).then((h) =>
        publicClient.waitForTransactionReceipt({ hash: h as Hex }),
      ),
      "empty document hash",
    );
    await expectRevert(
      write("issueCertificate", [OTHER_DOC, "", "R"]).then((h) =>
        publicClient.waitForTransactionReceipt({ hash: h as Hex }),
      ),
      "empty title",
    );
    await expectRevert(
      write("issueCertificate", [OTHER_DOC, "T", ""]).then((h) =>
        publicClient.waitForTransactionReceipt({ hash: h as Hex }),
      ),
      "empty recipient",
    );
  });

  await test("revoke works for the issuer, then verify returns invalid", async () => {
    const hash = await write("revokeCertificate", [1n]);
    await publicClient.waitForTransactionReceipt({ hash });
    const [valid, cert] = (await read("verifyCertificate", [
      deployer.address,
      DOC,
    ])) as [boolean, { revoked: boolean }];
    assert.equal(valid, false);
    assert.equal(cert.revoked, true);
  });

  await test("revoke by non-issuer, double revoke, and missing id revert", async () => {
    // Issue a fresh certificate as the deployer so the stranger is
    // definitely NOT its issuer (id 2 belongs to the stranger).
    const issueHash = await write("issueCertificate", [
      OTHER_DOC,
      "Revoke Target",
      "Grace",
    ]);
    await publicClient.waitForTransactionReceipt({ hash: issueHash });
    assert.equal(await read("certificateCount"), 3n);

    await expectRevert(
      write("revokeCertificate", [3n], strangerWallet).then((h) =>
        publicClient.waitForTransactionReceipt({ hash: h as Hex }),
      ),
      "not the issuer",
    );
    await expectRevert(
      write("revokeCertificate", [1n]).then((h) =>
        publicClient.waitForTransactionReceipt({ hash: h as Hex }),
      ),
      "already revoked",
    );
    await expectRevert(
      write("revokeCertificate", [999n]).then((h) =>
        publicClient.waitForTransactionReceipt({ hash: h as Hex }),
      ),
      "certificate not found",
    );
  });

  await test("PQ proof path: mock verifier true issues pqVerified certificate", async () => {
    await strangerWallet.writeContract({
      address: mockVerifier,
      abi: mockPQCVerifierAbi,
      functionName: "setResult",
      args: [true],
      account: strangerWallet.account ?? null,
      chain: LOCAL_CHAIN,
    });
    const hash = await write("issueCertificateWithPQProof", [
      keccak256(stringToHex("pq proof document")),
      "PQ Proof Cert",
      "Dave",
      FAKE_SIG,
      FAKE_PUBKEY,
    ]);
    await publicClient.waitForTransactionReceipt({ hash });
    const cert = (await read("getCertificate", [4n])) as {
      pqVerified: boolean;
      title: string;
    };
    assert.equal(cert.pqVerified, true);
    assert.equal(cert.title, "PQ Proof Cert");
  });

  await test("PQ proof path: mock verifier false reverts", async () => {
    await strangerWallet.writeContract({
      address: mockVerifier,
      abi: mockPQCVerifierAbi,
      functionName: "setResult",
      args: [false],
      account: strangerWallet.account ?? null,
      chain: LOCAL_CHAIN,
    });
    await expectRevert(
      write("issueCertificateWithPQProof", [
        keccak256(stringToHex("yet another doc")),
        "Bad Proof",
        "Eve",
        FAKE_SIG,
        FAKE_PUBKEY,
      ]).then((h) => publicClient.waitForTransactionReceipt({ hash: h as Hex })),
      "invalid ML-DSA proof",
    );
  });

  await test("PQ proof path: no verifier configured reverts", async () => {
    await expectRevert(
      write(
        "issueCertificateWithPQProof",
        [OTHER_DOC, "No Verifier", "Frank", FAKE_SIG, FAKE_PUBKEY],
        wallet,
        certNoVerifier,
      ).then((h) => publicClient.waitForTransactionReceipt({ hash: h as Hex })),
      "PQ verifier not set",
    );
  });

  await test("PQCVerifier returns false (no revert) where precompile is absent", async () => {
    const valid = await publicClient.readContract({
      address: realVerifier,
      abi: pqcVerifierAbi,
      functionName: "verify",
      args: [FAKE_PUBKEY, FAKE_SIG, DOC],
    });
    assert.equal(valid, false);
    const [registered, algorithmId, pubkey] =
      await publicClient.readContract({
        address: realVerifier,
        abi: pqcVerifierAbi,
        functionName: "keyStatus",
        args: [deployer.address],
      });
    assert.equal(registered, false);
    assert.equal(algorithmId, 0);
    assert.equal(pubkey, "0x");
  });

  await server.close();
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
