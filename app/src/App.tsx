import { useCallback, useEffect, useState } from "react";
import { parseEventLogs, type Address, type Hash, type WalletClient } from "viem";
import { pqcCertificateAbi } from "../../contracts/PQCCertificate.artifact.js";
import {
  CERTIFICATE_ADDRESS,
  CHAIN,
  connectWallet,
  explorerTxUrl,
  getPqKeyStatus,
  hashFile,
  hasInjectedWallet,
  issueCertificate,
  publicClient,
  verifyCertificate,
  type CertificateData,
} from "./lib/qore.js";

type Tab = "issue" | "verify";

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("issue");
  const [account, setAccount] = useState<Address | null>(null);
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [pqStatus, setPqStatus] = useState<{
    registered: boolean;
    algorithmId: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Issue form state.
  const [fileName, setFileName] = useState("");
  const [docHash, setDocHash] = useState<Hash | null>(null);
  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [issueTx, setIssueTx] = useState<Hash | null>(null);
  const [issueId, setIssueId] = useState<bigint | null>(null);

  // Verify form state.
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyIssuer, setVerifyIssuer] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    cert: CertificateData | null;
    id: bigint;
  } | null>(null);

  const onConnect = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { account: acc, wallet: w } = await connectWallet();
      setAccount(acc);
      setWallet(w);
      const status = await getPqKeyStatus(acc);
      setPqStatus({
        registered: status.registered,
        algorithmId: status.algorithmId,
      });
      if (!verifyIssuer) setVerifyIssuer(acc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [verifyIssuer]);

  // If the wallet disconnects, clear the session.
  useEffect(() => {
    if (!hasInjectedWallet()) return;
    const eth = (window as unknown as { ethereum: { on?: (e: string, f: () => void) => void } }).ethereum;
    eth.on?.("accountsChanged", () => {
      setAccount(null);
      setWallet(null);
      setPqStatus(null);
    });
  }, []);

  async function onPickFile(file: File | undefined, forVerify: boolean) {
    setError(null);
    setNotice(null);
    if (!file) return;
    try {
      const hash = await hashFile(file);
      if (forVerify) {
        setVerifyHash(hash);
      } else {
        setFileName(file.name);
        setDocHash(hash);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onIssue() {
    if (!wallet || !account || !docHash) return;
    if (!title.trim() || !recipient.trim()) {
      setError("Title and recipient are both required.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const hash = await issueCertificate(
        wallet,
        account,
        docHash,
        title.trim(),
        recipient.trim(),
      );
      setIssueTx(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({
        abi: pqcCertificateAbi,
        logs: receipt.logs,
        eventName: "CertificateIssued",
      });
      if (logs.length > 0) setIssueId(logs[0].args.id);
      setNotice(
        "Certificate issued on QoreChain testnet. The transaction was hybrid-signed by your wallet.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setError(null);
    setNotice(null);
    setVerifyResult(null);
    if (!/^0x[0-9a-fA-F]{64}$/.test(verifyHash.trim())) {
      setError("Document hash must be a 0x-prefixed 32-byte hex string.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(verifyIssuer.trim())) {
      setError("Issuer must be a 0x-prefixed Ethereum address.");
      return;
    }
    setBusy(true);
    try {
      const res = await verifyCertificate(
        verifyIssuer.trim() as Address,
        verifyHash.trim() as Hash,
      );
      setVerifyResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>PQC Certificate</h1>
          <p className="subtitle">
            Post-quantum certificates on QoreChain testnet — issue a
            certificate for any document hash, verify it on-chain.
          </p>
        </div>
        <div className="wallet">
          {account ? (
            <>
              <span className="address" title={account}>
                {short(account)}
              </span>
              <span
                className={`badge ${pqStatus?.registered ? "ok" : "warn"}`}
                title="On-chain ML-DSA key registration status (precompile 0x0a02)"
              >
                PQ key:{" "}
                {pqStatus
                  ? pqStatus.registered
                    ? `registered (alg ${pqStatus.algorithmId})`
                    : "not registered"
                  : "…"}
              </span>
            </>
          ) : (
            <button onClick={onConnect} disabled={busy}>
              {busy ? "Connecting…" : "Connect QoreX"}
            </button>
          )}
        </div>
      </header>

      <p className="network">
        Network: {CHAIN.name} · EVM chain id {CHAIN.id} · Testnet only — no
        real funds.
      </p>

      {!CERTIFICATE_ADDRESS && (
        <div className="banner warn">
          Contract not deployed yet. Set <code>VITE_CERTIFICATE_ADDRESS</code>{" "}
          in <code>app/.env</code> after running <code>npm run deploy</code>{" "}
          (see DEPLOY.md). Reads and writes are disabled until then.
        </div>
      )}

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <nav className="tabs">
        <button
          className={tab === "issue" ? "active" : ""}
          onClick={() => setTab("issue")}
        >
          Issue a certificate
        </button>
        <button
          className={tab === "verify" ? "active" : ""}
          onClick={() => setTab("verify")}
        >
          Verify a certificate
        </button>
      </nav>

      {tab === "issue" && (
        <section className="card">
          <h2>Issue a certificate</h2>
          <p>
            Pick a document — only its <code>keccak256</code> hash is stored
            on-chain, never the file itself. The issuing transaction is
            hybrid-signed (secp256k1 + ML-DSA-87) by QoreX.
          </p>
          <label className="field">
            Document file
            <input
              type="file"
              onChange={(e) => void onPickFile(e.target.files?.[0], false)}
            />
          </label>
          {docHash && (
            <p className="mono">
              {fileName} → document hash{" "}
              <code>{docHash}</code>
            </p>
          )}
          <label className="field">
            Title
            <input
              type="text"
              placeholder="e.g. PQC Certificate — Workshop 2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            Recipient
            <input
              type="text"
              placeholder="e.g. Alice"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </label>
          <button
            onClick={() => void onIssue()}
            disabled={busy || !account || !docHash || !CERTIFICATE_ADDRESS}
          >
            {busy ? "Sending…" : "Issue certificate"}
          </button>
          {!account && (
            <p className="hint">Connect QoreX first to issue a certificate.</p>
          )}
          {issueTx && (
            <p>
              Transaction:{" "}
              <a href={explorerTxUrl(issueTx)} target="_blank" rel="noreferrer">
                {issueTx}
              </a>
              {issueId !== null && (
                <> · Certificate id: <strong>#{issueId.toString()}</strong></>
              )}
            </p>
          )}
        </section>
      )}

      {tab === "verify" && (
        <section className="card">
          <h2>Verify a certificate</h2>
          <p>
            Upload the document (its hash is recomputed locally) or paste a
            document hash, plus the issuer&apos;s address. The check reads the
            on-chain registry — no wallet needed.
          </p>
          <label className="field">
            Document file (optional — fills the hash)
            <input
              type="file"
              onChange={(e) => void onPickFile(e.target.files?.[0], true)}
            />
          </label>
          <label className="field">
            Document hash
            <input
              type="text"
              placeholder="0x… (32 bytes)"
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
            />
          </label>
          <label className="field">
            Issuer address
            <input
              type="text"
              placeholder="0x…"
              value={verifyIssuer}
              onChange={(e) => setVerifyIssuer(e.target.value)}
            />
          </label>
          <button
            onClick={() => void onVerify()}
            disabled={busy || !CERTIFICATE_ADDRESS}
          >
            {busy ? "Checking…" : "Verify"}
          </button>
          {verifyResult && (
            <div
              className={`result ${verifyResult.valid ? "valid" : "invalid"}`}
            >
              {verifyResult.valid ? (
                <>
                  <h3>✓ Valid certificate</h3>
                  <dl>
                    <dt>Certificate id</dt>
                    <dd>#{verifyResult.id.toString()}</dd>
                    <dt>Title</dt>
                    <dd>{verifyResult.cert?.title}</dd>
                    <dt>Recipient</dt>
                    <dd>{verifyResult.cert?.recipient}</dd>
                    <dt>Issuer</dt>
                    <dd>
                      <code>{verifyResult.cert?.issuer}</code>
                    </dd>
                    <dt>Issued</dt>
                    <dd>
                      {verifyResult.cert
                        ? new Date(
                            Number(verifyResult.cert.issuedAt) * 1000,
                          ).toLocaleString()
                        : "—"}
                    </dd>
                    <dt>PQ proof</dt>
                    <dd>
                      {verifyResult.cert?.pqVerified
                        ? "ML-DSA-87 proof verified on-chain"
                        : "No on-chain ML-DSA proof (plain issuance)"}
                    </dd>
                  </dl>
                </>
              ) : verifyResult.cert ? (
                <>
                  <h3>✗ Certificate revoked</h3>
                  <p>
                    A certificate for this document and issuer exists
                    (#{verifyResult.id.toString()}) but was revoked by its
                    issuer.
                  </p>
                </>
              ) : (
                <>
                  <h3>✗ Not found</h3>
                  <p>
                    No certificate for this document hash and issuer exists
                    on-chain.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <footer>
        <p>
          Built for the QoreChain Developer Fest “Build Before Q-Day” —
          Quantum Pass. Contract:{" "}
          <code>{CERTIFICATE_ADDRESS ?? "not deployed yet"}</code> ·{" "}
          <a
            href="https://build.qorechain.io/"
            target="_blank"
            rel="noreferrer"
          >
            build.qorechain.io
          </a>
        </p>
      </footer>
    </div>
  );
}
