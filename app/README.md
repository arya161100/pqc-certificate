# PQC Certificate — Frontend

Vite + React + TypeScript + viem frontend for the PQC Certificate project
(QoreChain Developer Fest, Quantum Pass). Two tabs:

- **Issue a certificate** — pick a document file (only its `keccak256`
  hash is stored on-chain), enter a title and recipient, and send the
  issuing transaction from the connected wallet (QoreX). The transaction is
  hybrid-signed by the wallet.
- **Verify a certificate** — upload the document (hash recomputed locally)
  or paste a document hash + issuer address; reads the on-chain registry
  and shows validity, title, recipient, issue time, and whether an on-chain
  ML-DSA-87 proof exists. No wallet needed for verification.

The header shows the connected account and its on-chain ML-DSA key
registration status (precompile `0x0a02`).

## Setup

```sh
npm install
cp .env.example .env
# Set VITE_CERTIFICATE_ADDRESS (and VITE_VERIFIER_ADDRESS) in .env from
# ../deployments/qorechain-diana-9800.json after deploying (see ../DEPLOY.md).
npm run dev      # local dev server
npm run build    # production build into dist/ (static — host anywhere)
npx vite preview --port 4173   # serve the production build locally
```

## Notes

- Testnet only (QoreChain `qorechain-diana`, EVM chain id 9800). The app
  switches the wallet to chain 9800 on connect.
- Contract ABIs are imported directly from `../contracts/*.artifact.ts`
  (single source of truth — no duplicated ABI).
- The chain object is defined locally with viem's `defineChain` (same
  values as the SDK's `qorechainTestnet`) so the app compiles against its
  own viem version.
- The PQ-proof issuance path (`issueCertificateWithPQProof`) is available
  at contract level but not wired into this UI yet: it needs wallet-side
  ML-DSA signing (QoreX / QoreSign), which a plain injected provider does
  not expose. See the root README ("Known assumptions").
