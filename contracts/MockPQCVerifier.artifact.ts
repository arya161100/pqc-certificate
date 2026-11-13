/**
 * Compiled artifact for `contracts/MockPQCVerifier.sol` (`MockPQCVerifier`).
 * * TEST-ONLY contract. Never deploy this as the certificate verifier on testnet/mainnet.
 * Generated with solc 0.8.24 (`--optimize`). Regenerate with
 * `npm run compile` after editing the contract.
 */
import type { Hex } from "viem";

export const mockPQCVerifierAbi = [{"inputs":[],"name":"result","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bool","name":"r","type":"bool"}],"name":"setResult","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes","name":"","type":"bytes"},{"internalType":"bytes","name":"","type":"bytes"},{"internalType":"bytes","name":"","type":"bytes"}],"name":"verify","outputs":[{"internalType":"bool","name":"valid","type":"bool"}],"stateMutability":"view","type":"function"}] as const;

export const mockPQCVerifierBytecode = "0x608060405234801561000f575f80fd5b506101d68061001d5f395ff3fe608060405234801561000f575f80fd5b506004361061003f575f3560e01c80636537214714610043578063de8f50a114610063578063f4b4dc2e14610080575b5f80fd5b5f5461004f9060ff1681565b604051901515815260200160405180910390f35b61004f6100713660046100e7565b5f5460ff169695505050505050565b6100a061008e36600461017a565b5f805460ff1916911515919091179055565b005b5f8083601f8401126100b2575f80fd5b50813567ffffffffffffffff8111156100c9575f80fd5b6020830191508360208285010111156100e0575f80fd5b9250929050565b5f805f805f80606087890312156100fc575f80fd5b863567ffffffffffffffff80821115610113575f80fd5b61011f8a838b016100a2565b90985096506020890135915080821115610137575f80fd5b6101438a838b016100a2565b9096509450604089013591508082111561015b575f80fd5b5061016889828a016100a2565b979a9699509497509295939492505050565b5f6020828403121561018a575f80fd5b81358015158114610199575f80fd5b939250505056fea26469706673582212200bd556709d3a5ce160baf1a1d98d845ea7a50b14dd03ca606c18055162b683a764736f6c63430008180033" as Hex;
