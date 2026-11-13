# DEPLOY.md — Deploy PQC Certificate to QoreChain testnet

Everything here is **testnet-only** (`qorechain-diana`, EVM chain id 9800).
No real funds. Estimated time: 30–60 minutes once the faucet and window are
ready. The agent (Muse) cannot do these steps for you: they need **your**
QoreX wallet, your faucet claim, and your key.

## Prerequisites (already done)

- [x] Fest registration complete (4/4): GitHub `arya161100`, Level Quantum
      Pass, Tim Solo, X `@aryar221`, QoreX connected.
- [x] Your QoreX EVM address `0x705d79bcfc308a60979f339fec8b8071e640b1b8`
      already has a **registered PQ key** (verified 13 Nov 2026:
      `pqcKeyStatus` → `registered=true`, `algorithmId=1`).
      Re-check any time with: `npx tsx scripts/check-pqc.ts`
- [x] Contracts compile, 12/12 tests pass, deploy script verified on a
      local chain.

## Step 1 — Claim test tokens from the faucet (you)

1. Open https://dashboard.qorechain.io/faucet and sign in to the Dashboard.
2. Paste your testnet address (no wallet connect needed for the claim):
   `qor1wpwhn08uxz9xp9ulxw07ezuqw8nypvdcw8vh8j`
3. Claim. You get per 24 hours: **100 QOR + 1000 fUSD + 0.5 fETH +
   0.02 fBTC** (test tokens, no value, cannot move to mainnet).
4. The EVM side needs QOR for gas. If the faucet only credits the Cosmos
   address, convert with the Dashboard / `MsgConvertCoin` flow, or use
   QoreX's built-in faucet flow — the deploy needs only a small amount
   (deploy + 1 demo issue is well under 1 QOR of gas).

## Step 2 — Open an EVM authorisation window (you)

Before **any** EVM transaction (including deploy), the account needs a live
EVM window, opened with a hybrid-signed Cosmos transaction. QoreX opens one
automatically when you send your first EVM transaction; otherwise use the
official CLI (binary release from `download.qore.host`):

```sh
# Unscoped window first — deploy is a contract creation, and scoped windows
# reject contract creation. 7200 blocks ≈ 6h on testnet, 20 txs, 1000 QOR.
qorechaind tx pqc open-evm-window 7200 20 1000qor --from <your-key-name> \
  --chain-id qorechain-diana --gas 400000 --fees 40000uqor --generate-only > w.json
qorechaind tx pqc cosign w.json --from <your-key-name> --pqc-key <your-pqc-key> \
  --chain-id qorechain-diana

# Check the window:
qorechaind query pqc evm-window <your-qor1-address>
```

Opening a window advances the account nonce — **deploy only after the
window transaction lands**. This window-opening transaction is itself a
hybrid-signed transaction, which is the fest's "one hybrid-signed
transaction" requirement (alongside any transaction sent through QoreX).

## Step 3 — Configure the deploy environment (you)

```sh
cd ~/workspace/qorechain/pqc-certificate
cp .env.example .env   # if you haven't already
```

Edit `.env`:

```
QORE_EVM_RPC_URL=https://evm-testnet.qore.host
QORE_EVM_PRIVATE_KEY=0x...   # the EVM account's key, 0x-prefixed, 64 hex chars
```

- The key must belong to the EVM account of the wallet that will own the
  certificates: in QoreX, **"Add an Ethereum account (coin 60)"**, then
  export that account's private key.
- **Never commit `.env`, never paste the key in chat, never send it to
  anyone.** The deploy script refuses the placeholder key and refuses
  mainnet (chain id 9801).

## Step 4 — Deploy (you)

```sh
npm install        # if not done already
npm run deploy
```

Expected output: `PQCVerifier` address, `PQCCertificate` address, one demo
certificate issued, `certificateCount: 1`, `verifyCertificate: valid=true`,
and a file `deployments/qorechain-diana-9800.json` with all addresses and
transaction hashes. Keep that file — the frontend and the fest submission
need the contract address from it.

If deploy fails with an authorisation error, the EVM window has expired or
was never opened — repeat Step 2, then deploy again. (Deploying twice just
creates a second deployment; use the newest addresses.)

## Step 5 — Verify on the explorer (you)

Open https://explore.qore.network, switch to **Testnet**, and search the
`PQCCertificate` address and the deploy/issue transaction hashes from
`deployments/qorechain-diana-9800.json`. Confirm the contract has code and
the demo certificate transaction succeeded.

## Step 6 — Point the frontend at the deployment (you)

```sh
cd app
cp .env.example .env
```

Set in `app/.env` (copy from `deployments/qorechain-diana-9800.json`):

```
VITE_CERTIFICATE_ADDRESS=0x...   # PQCCertificate address
VITE_VERIFIER_ADDRESS=0x...      # PQCVerifier address
```

Then build and check it serves:

```sh
npm install
npm run build
npx vite preview --port 4173   # open http://localhost:4173, check Issue/Verify render
```

## Step 7 — Host the demo (you)

The fest requires a live demo URL. Any static host works (the app is a
static Vite build, `app/dist/`):

- **Vercel:** `npx vercel --prod` from `app/` (or import the repo in the
  Vercel dashboard), or
- **Netlify:** drag `app/dist/` into https://app.netlify.com/drop, or
- **GitHub Pages:** push the repo (see SUBMIT.md) and enable Pages on the
  `app/dist` output.

Save the demo URL — you need it for the submission.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `QORE_EVM_PRIVATE_KEY is still the placeholder` | Set a real key in `.env`. |
| `Refusing to deploy to mainnet` | `QORE_EVM_RPC_URL` points at mainnet. Use `https://evm-testnet.qore.host`. |
| Deploy tx reverts / is rejected | EVM window missing or expired — repeat Step 2. |
| `certificateCount` is 0 after deploy | The demo issue tx failed — check the issue tx on the explorer; likely the window closed mid-deploy. Re-run deploy with a fresh window. |
| Frontend shows "Contract not deployed yet" | `VITE_CERTIFICATE_ADDRESS` is empty — set it in `app/.env` and rebuild. |
| Frontend can't connect wallet | QoreX not installed, or not on testnet — in QoreX mobile: Settings → Use testnet (developers). |
