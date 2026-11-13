# AI_USAGE.md — How AI was used to build PQC Certificate

Required for the **Best AI-Native Build** special award ($500). This file
documents the AI workflow, what was generated, and what the human did.

## Tools

- **Muse (Meta)** — the coding agent that wrote the code in this repo,
  driven by the user in chat (Indonesian). No other AI tool was used.
- **QoreChain SDK 0.14.0 / `create-qorechain-dapp`** — the official scaffold
  (template `evm-solidity`) the project started from.

## What the AI generated

- The three Solidity contracts (`PQCCertificate`, `PQCVerifier`,
  `MockPQCVerifier`) and the `IPQCVerifier` interface, including the
  low-level precompile call handling and the stack-too-deep refactor.
- The compile script (`scripts/compile.ts`, solc → TypeScript artifacts),
  the deploy script (`scripts/deploy.ts`), the read-only PQ-status checker
  (`scripts/check-pqc.ts`), and the 12-test suite (`test/`).
- The Vite + React + viem frontend (`app/`): Issue/Verify tabs, wallet
  connect, file hashing, on-chain verification, PQ key status display.
- This file, `README.md`, `DEPLOY.md`, and `SUBMIT.md`.

## What the human did (and must still do)

- **Direction:** chose the "PQC Certificate" idea from the research
  strategy, chose Quantum Pass as the anchor category, and approved the
  plan to build it.
- **Registration:** completed the fest registration personally (GitHub,
  details, X post, QoreX manual proof) — 4/4 on 13 Nov 2026.
- **Verification of facts:** the AI's claims were checked against the
  research report and live endpoints (testnet RPC chain 9800, PQ key
  status of the user's address) — those checks are recorded in the README.
- **Still to do by the human:** faucet claim, EVM window, testnet deploy
  with their own key, frontend hosting, GitHub push, and fest submission.
  The AI deliberately cannot do these: they need the user's wallet and
  accounts, and submission needs the user's explicit approval.

## Review process

- Every contract was compiled with solc 0.8.24 and exercised by 12
  automated tests on a local chain (issuance, uniqueness, validation,
  revocation, PQ-proof path, precompile-absent behaviour) — 12/12 pass.
- The deploy script was run end-to-end against a local ganache chain.
- The frontend production build was verified (`vite build` clean) and
  smoke-tested over HTTP (index + bundle serve 200).
- Known open assumptions are listed honestly in the README ("Known
  assumptions") instead of being papered over — notably the exact message
  encoding the testnet `pqcVerify` precompile expects, which will be
  confirmed at deploy time.

## Human contribution share

The human supplied the goal, the constraints (testnet-only, no wallet
access for the agent, no spending, preview-before-submit), the accounts and
keys, and all external actions. The AI supplied the implementation and
documentation. The project would not exist in this form without either side.
