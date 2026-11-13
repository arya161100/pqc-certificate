# SUBMIT.md — Submit PQC Certificate to the QoreChain Developer Fest

Fest: **"Build Before Q-Day"** — https://build.qorechain.io/
Category: **Quantum Pass** (solo, Level Quantum Pass)
Building period: **4 Nov – 2 Dec 2026** (submit before the deadline; the
site shows a live countdown — check it before submitting).
Cost: **free** (no registration fee, no submit fee, no deposit).

> Do **not** submit until the deploy (DEPLOY.md) is done and the demo URL
> works. Submission needs the user (Muse cannot submit on your behalf
> without your approval — show the preview first, per your standing rule).

## Step 1 — Push the code to a public GitHub repo (you)

The fest links your project page to a public GitHub repo (commits appear
automatically in the project Timeline).

```sh
cd ~/workspace/qorechain/pqc-certificate
# Recommended: create the repo on github.com first (public), then:
git init
git add .
git commit -m "PQC Certificate — QoreChain Developer Fest (Quantum Pass)"
git branch -M main
git remote add origin https://github.com/arya161100/pqc-certificate.git
git push -u origin main
```

Check `.gitignore` covers `.env`, `node_modules/`, `app/dist/`, and local
`deployments/chain-*.json` before pushing. **Never push `.env`** (it holds
the deploy private key).

## Step 2 — Create the project on build.qorechain.io (you)

1. Open https://build.qorechain.io/ and sign in (your registration is
   complete: GitHub `arya161100`, Quantum Pass, Solo).
2. Create a project:
   - **Category:** Quantum Pass (one project = one category).
   - **Country:** pick the country you represent (for Regional Awards).
   - **Name:** PQC Certificate.
   - **Repository:** link the public GitHub repo from Step 1.
   - **Contract address:** the `PQCCertificate` address from
     `deployments/qorechain-diana-9800.json`.
   - **Live demo URL:** the hosted frontend URL from DEPLOY.md Step 7.
   - **About / How it's made:** describe the project (see the README):
     certificates bind a document hash to an issuer on-chain; issuance is
     hybrid-signed via QoreX; optional on-chain ML-DSA-87 proof via the
     `0x0a01` precompile; verification reads the registry + the issuer's
     PQ key status (`0x0a02`).
   - **README:** include the fest badge + a link to the project page
     (`https://build.qorechain.io/p/<slug>`).
3. Optional but recommended:
   - Include `AI_USAGE.md` (already in this repo) — required for the
     **Best AI-Native Build** ($500) award.
   - Post progress on X with **#BuildBeforeQDay** (helps People's Choice).

## Step 3 — Confirm the submission checklist (you)

- [ ] Repo is public and the fest project page shows your commits.
- [ ] Contract address is the testnet deployment (chain 9800, not mainnet).
- [ ] Demo URL loads and Issue/Verify work with QoreX on testnet.
- [ ] At least one hybrid-signed transaction exists for the project
      (EVM window opening tx and/or the deploy + demo issue txs).
- [ ] README + AI_USAGE.md are in the repo.
- [ ] Submitted before 2 Dec 2026.

## After submitting

- **Workshop 2 (Sat 14 Nov 2026, 12:00 UTC)** and **Workshop 3 (20 Nov)**
  are good places to validate the approach (scoped window, `pqcVerify`)
  and ask about judging criteria, which are not published.
- **Upgrade path (optional, before the deadline):** the same codebase is
  structured for the **Post-Quantum dApp** category — build the
  "Quantum-Safe Vault" on top of `IPQCVerifier`/`PQCVerifier` (scoped EVM
  window + `pqcVerify` + Foundry/Hardhat tests + two-stage QCAI audit).
  One project = one category, so decide the final category before the
  deadline; if the vault is not stable by ~28 Nov, stay in Quantum Pass.
- Rules, prizes and dates are not final and may change until the end of the
  event — re-check https://build.qorechain.io/ every 2–3 days.
