// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IPQCVerifier
/// @notice Minimal interface for on-chain ML-DSA-87 signature verification.
/// @dev Implemented by `PQCVerifier`, which forwards to the QoreChain PQC
///      precompile (0x0a01, testnet-only). Kept as an interface so the
///      Post-Quantum dApp upgrade ("Quantum-Safe Vault") can reuse the same
///      verification path, and so tests can substitute a mock.
interface IPQCVerifier {
    /// @param publicKey ML-DSA-87 public key bytes.
    /// @param signature ML-DSA-87 signature bytes.
    /// @param message The exact bytes that were signed. For certificates this
    ///        is the 32-byte document hash (abi.encodePacked(documentHash)).
    /// @return valid True only when the signature is confirmed valid.
    function verify(
        bytes calldata publicKey,
        bytes calldata signature,
        bytes calldata message
    ) external view returns (bool valid);
}
