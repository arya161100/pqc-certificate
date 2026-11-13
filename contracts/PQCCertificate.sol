// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IPQCVerifier.sol";

/// @title PQCCertificate
/// @notice Post-quantum certificates on QoreChain testnet.
///
///         A certificate binds a document hash to an issuer, a title and a
///         recipient, and stores the record on-chain so anyone can verify
///         that a document was certified by a given address at a given time.
///
///         Two issuance paths:
///         - `issueCertificate`: plain issuance. The transaction itself is
///           hybrid-signed when sent through QoreX (secp256k1 + ML-DSA-87),
///           which is what the Quantum Pass category requires.
///         - `issueCertificateWithPQProof`: additionally verifies an ML-DSA-87
///           signature over the document hash on-chain through the
///           `IPQCVerifier` (QoreChain PQC precompile 0x0a01, testnet-only).
///           The certificate is then marked `pqVerified`.
///
///         Upgrade path: the verifier is an interface, so the Post-Quantum
///         dApp upgrade ("Quantum-Safe Vault") reuses `IPQCVerifier` /
///         `PQCVerifier` unchanged for its scoped-window + `pqcVerify` checks.
/// @dev One live certificate per (issuer, documentHash). Ids start at 1;
///      `certificateIdOf` returns 0 when no certificate exists.
contract PQCCertificate {
    /// @notice A single issued certificate.
    struct Certificate {
        address issuer;
        string title;
        string recipient;
        bytes32 documentHash;
        uint256 issuedAt;
        bool pqVerified;
        bool revoked;
    }

    /// @notice The PQ verifier used by the proof path. address(0) disables it.
    IPQCVerifier public immutable verifier;

    /// @notice Number of certificates ever issued (also the last id).
    uint256 public certificateCount;

    /// @notice id => certificate. Ids start at 1.
    mapping(uint256 => Certificate) public certificates;

    /// @notice keccak256(issuer, documentHash) => id (0 when none).
    mapping(bytes32 => uint256) public certificateIdOf;

    /// @notice Emitted when a certificate is issued.
    event CertificateIssued(
        uint256 indexed id,
        address indexed issuer,
        bytes32 indexed documentHash,
        string title,
        string recipient,
        bool pqVerified
    );

    /// @notice Emitted when a certificate is revoked by its issuer.
    event CertificateRevoked(uint256 indexed id, address indexed issuer);

    /// @param verifier_ Address of the `IPQCVerifier` to use for PQ proofs,
    ///        or address(0) to deploy without the PQ-proof path.
    constructor(address verifier_) {
        verifier = IPQCVerifier(verifier_);
    }

    /// @notice Issue a certificate for a document hash.
    /// @param documentHash keccak256 of the certified document bytes.
    /// @param title Human-readable certificate title.
    /// @param recipient Name (or identifier) of the certificate recipient.
    /// @return id The new certificate id.
    function issueCertificate(
        bytes32 documentHash,
        string calldata title,
        string calldata recipient
    ) external returns (uint256 id) {
        return _issue(documentHash, title, recipient, false);
    }

    /// @notice Issue a certificate with an on-chain ML-DSA-87 proof.
    /// @param documentHash keccak256 of the certified document bytes.
    /// @param title Human-readable certificate title.
    /// @param recipient Name (or identifier) of the certificate recipient.
    /// @param mlDsaSignature ML-DSA-87 signature over the 32-byte
    ///        document hash, produced with the issuer's ML-DSA key
    ///        (e.g. via QoreX / QoreSign).
    /// @param mlDsaPublicKey The issuer's ML-DSA-87 public key bytes.
    /// @return id The new certificate id.
    function issueCertificateWithPQProof(
        bytes32 documentHash,
        string calldata title,
        string calldata recipient,
        bytes calldata mlDsaSignature,
        bytes calldata mlDsaPublicKey
    ) external returns (uint256 id) {
        _checkPQProof(documentHash, mlDsaSignature, mlDsaPublicKey);
        return _issue(documentHash, title, recipient, true);
    }

    /// @notice Revoke a certificate. Only its issuer can revoke it.
    /// @param id The certificate id to revoke.
    function revokeCertificate(uint256 id) external {
        Certificate storage cert = certificates[id];
        require(cert.issuer != address(0), "certificate not found");
        require(cert.issuer == msg.sender, "not the issuer");
        require(!cert.revoked, "already revoked");
        cert.revoked = true;
        emit CertificateRevoked(id, msg.sender);
    }

    /// @notice Read a certificate by id.
    /// @param id The certificate id.
    /// @return cert The stored certificate (issuer == address(0) when missing).
    function getCertificate(
        uint256 id
    ) external view returns (Certificate memory cert) {
        return certificates[id];
    }

    /// @notice Verify a document hash against an issuer's record.
    /// @param issuer The address that supposedly issued the certificate.
    /// @param documentHash keccak256 of the document to check.
    /// @return valid True only when a live (non-revoked) certificate exists.
    /// @return cert The stored certificate (empty when none exists).
    function verifyCertificate(
        address issuer,
        bytes32 documentHash
    ) external view returns (bool valid, Certificate memory cert) {
        uint256 id = certificateIdOf[
            keccak256(abi.encodePacked(issuer, documentHash))
        ];
        if (id == 0) return (false, cert);
        cert = certificates[id];
        valid = !cert.revoked;
        return (valid, cert);
    }

    /// @notice Verify an ML-DSA-87 proof over a document hash through the
    ///         configured verifier. Separated from the issuance function to
    ///         keep stack usage low.
    function _checkPQProof(
        bytes32 documentHash,
        bytes calldata mlDsaSignature,
        bytes calldata mlDsaPublicKey
    ) internal view {
        require(address(verifier) != address(0), "PQ verifier not set");
        require(
            mlDsaSignature.length > 0 && mlDsaPublicKey.length > 0,
            "empty PQ proof"
        );
        bool valid = verifier.verify(
            mlDsaPublicKey,
            mlDsaSignature,
            abi.encodePacked(documentHash)
        );
        require(valid, "invalid ML-DSA proof");
    }

    function _issue(
        bytes32 documentHash,
        string calldata title,
        string calldata recipient,
        bool pqVerified
    ) internal returns (uint256 id) {
        require(documentHash != bytes32(0), "empty document hash");
        require(bytes(title).length > 0, "empty title");
        require(bytes(recipient).length > 0, "empty recipient");
        bytes32 key = keccak256(abi.encodePacked(msg.sender, documentHash));
        require(certificateIdOf[key] == 0, "already certified");
        id = ++certificateCount;
        certificates[id] = Certificate({
            issuer: msg.sender,
            title: title,
            recipient: recipient,
            documentHash: documentHash,
            issuedAt: block.timestamp,
            pqVerified: pqVerified,
            revoked: false
        });
        certificateIdOf[key] = id;
        emit CertificateIssued(
            id,
            msg.sender,
            documentHash,
            title,
            recipient,
            pqVerified
        );
    }
}
