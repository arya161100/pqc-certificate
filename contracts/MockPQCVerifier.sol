// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IPQCVerifier.sol";

/// @title MockPQCVerifier
/// @notice TEST-ONLY stand-in for `PQCVerifier`. Returns a configured result
///         so the PQ-proof issuance path can be exercised on a local chain,
///         where the real 0x0a01 precompile does not exist.
/// @dev Never deploy this to testnet/mainnet as the certificate verifier.
contract MockPQCVerifier is IPQCVerifier {
    bool public result;

    function setResult(bool r) external {
        result = r;
    }

    /// @inheritdoc IPQCVerifier
    function verify(
        bytes calldata,
        bytes calldata,
        bytes calldata
    ) external view returns (bool valid) {
        return result;
    }
}
