// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IPQCVerifier.sol";

/// @title PQCVerifier
/// @notice On-chain ML-DSA-87 verification via the QoreChain PQC precompile.
/// @dev The precompile lives at 0x0a01 and is active on testnet only
///      (proposal 21, 27 Oct 2026). On chains where it is inactive, a call
///      returns empty data instead of reverting — so this contract uses a
///      low-level staticcall and treats empty/malformed returndata as
///      "not verified" (false) rather than reverting. That keeps certificate
///      issuance working even when the PQ path is unavailable, and lets the
///      same code run on a local dev chain for tests.
contract PQCVerifier is IPQCVerifier {
    /// @notice Fixed address of the PQC Verify precompile.
    address public constant PQC_VERIFY_PRECOMPILE =
        0x0000000000000000000000000000000000000a01;
    /// @notice Fixed address of the PQC Key Status precompile.
    address public constant PQC_KEY_STATUS_PRECOMPILE =
        0x0000000000000000000000000000000000000a02;

    /// @inheritdoc IPQCVerifier
    function verify(
        bytes calldata publicKey,
        bytes calldata signature,
        bytes calldata message
    ) external view returns (bool valid) {
        (bool ok, bytes memory ret) = PQC_VERIFY_PRECOMPILE.staticcall(
            abi.encodeWithSignature(
                "pqcVerify(bytes,bytes,bytes)",
                publicKey,
                signature,
                message
            )
        );
        if (!ok || ret.length < 32) return false;
        return abi.decode(ret, (bool));
    }

    /// @notice Read an account's on-chain ML-DSA key registration status.
    /// @param account The EVM address to check.
    /// @return registered True when the account has a registered PQ key.
    /// @return algorithmId Algorithm id of the registered key (0 when none).
    /// @return publicKey The registered ML-DSA public key (empty when none).
    function keyStatus(
        address account
    )
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory publicKey)
    {
        (bool ok, bytes memory ret) = PQC_KEY_STATUS_PRECOMPILE.staticcall(
            abi.encodeWithSignature("pqcKeyStatus(address)", account)
        );
        // A well-formed (bool, uint8, bytes) tuple is at least 128 bytes
        // (96 head + 32 length word) with the bytes offset word == 96.
        // Anything else means the precompile is inactive or misbehaving.
        if (!ok || ret.length < 128) return (false, 0, "");
        uint256 offset;
        assembly {
            offset := mload(add(add(ret, 32), 64))
        }
        if (offset != 96) return (false, 0, "");
        return abi.decode(ret, (bool, uint8, bytes));
    }
}
