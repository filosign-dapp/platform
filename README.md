# Filosign Platform

The core TypeScript/JavaScript client library and utilities for interacting with the Filosign decentralized e-signature platform. Provides high-level APIs for user registration, authentication, document signing, and secure communication.

## Overview

The Platform package contains:

- **Client Library**: High-level API for Filosign operations
- **Type Definitions**: TypeScript interfaces and types
- **Utilities**: Helper functions for common operations

## Architecture

### FilosignClient Class
The main client for interacting with Filosign:

```typescript
import { FilosignClient } from "@filosign/platform";

const client = new FilosignClient(walletClient);
await client.initialize();
```

### Key Components

#### User Management
- **Registration**: Zero-knowledge registration with PIN-based encryption
- **Authentication**: Secure login with key regeneration
- **Identity Verification**: On-chain cryptographic identity management

#### Document Operations
- **File Registration**: Register documents for signing on-chain
- **Acknowledgment**: Confirm document receipt
- **Signature Submission**: Submit cryptographic signatures
- **Status Tracking**: Query document and signature states

#### Secure Communication
- **End-to-End Encryption**: ECDH-based document encryption
- **Shared Keys**: Ephemeral encryption for secure file exchange
- **Recipient Management**: Approve trusted senders

## Installation

```bash
bun add @filosign/platform
```

## Quick Start

```typescript
import { FilosignClient } from "@filosign/platform";

// Initialize with wallet
const client = new FilosignClient(walletClient);
await client.initialize();

// Register user (first time only)
await client.register("your-secure-pin");

// Login (subsequent sessions)
await client.login("your-secure-pin");

// Register a document for signing
const documentCid = "bafy..."; // IPFS/Filecoin CID
await client.registerDocument(documentCid, recipientAddress);

// As recipient: acknowledge document
await client.acknowledgeDocument(cidIdentifier);

// Submit signature
await client.submitSignature(cidIdentifier, signatureData);

// Encrypt document for secure transmission
const { encrypted, iv } = await client.encryptDocument(documentData, recipientAddress);

// Decrypt received document
const decrypted = await client.decryptDocument(encryptedData, iv, senderAddress);
```

## API Reference

### FilosignClient Methods

#### Initialization
- `constructor(wallet: Wallet)` - Create client instance
- `initialize()` - Setup contracts and version synchronization

#### User Management
- `isRegistered(): Promise<boolean>` - Check registration status
- `register(pin: string): Promise<void>` - Register new user with PIN
- `login(pin: string): Promise<void>` - Authenticate and regenerate keys

#### Document Operations
- `registerDocument(cid: string, recipient: Address): Promise<Hash>` - Register document for signing
- `acknowledgeDocument(cidIdentifier: string): Promise<Hash>` - Acknowledge document receipt
- `submitSignature(cidIdentifier: string, signatureData: SignatureData): Promise<Hash>` - Submit signature
- `getDocumentData(cidIdentifier: string): Promise<FileData>` - Get document information
- `getSignatureData(cidIdentifier: string): Promise<SignatureData>` - Get signature information

#### Secure Communication
- `encryptDocument(data: Uint8Array, recipient: Address): Promise<{encrypted: ArrayBuffer, iv: Uint8Array}>` - Encrypt document
- `decryptDocument(encrypted: ArrayBuffer, iv: Uint8Array, sender: Address): Promise<Uint8Array>` - Decrypt document

### Utility Functions

```typescript
import { computeCidIdentifier, validateSignature } from "@filosign/platform";

// Compute CID identifier from pieces
const identifier = computeCidIdentifier(pieceCidPrefix, pieceCidTail);

// Validate signature format
const isValid = validateSignature(signatureData);
```

## Integration with Filosign Ecosystem

### Smart Contracts Layer
The platform integrates directly with Filosign smart contracts:
- **FSManager**: Access control and coordination
- **FSFileRegistry**: Document and signature management
- **FSKeyRegistry**: Cryptographic identity storage

### Crypto Utils Layer
Leverages WebAssembly cryptographic operations:
- **Key Derivation**: PIN-based encryption key generation
- **ECDH Exchange**: Secure key exchange for document encryption
- **Signature Verification**: Cryptographic signature validation

### Storage Layer
Works with decentralized storage solutions:
- **IPFS**: Content addressing for documents
- **Filecoin**: Long-term storage guarantees
- **CID Management**: Content identifier generation and validation

## Security Model

### Zero-Knowledge Registration
- PIN never stored on-chain or servers
- Commitment-based verification prevents PIN theft
- Encrypted seed storage with PIN-derived keys

### Session-Based Security
- Encryption keys regenerated per login session
- No long-term key storage in memory
- Automatic cleanup of sensitive data

### End-to-End Encryption
- ECDH key exchange for document encryption
- AES-GCM authenticated encryption
- Ephemeral keys for each communication

## Development

```bash
# Install dependencies
bun install

# Build library
bun run build

# Run tests
bun run test

# Generate documentation
bun run docs

# Start development server
bun run dev
```

## Configuration

### Network Configuration
```typescript
const client = new FilosignClient(walletClient, {
  chainId: 314159, // Filecoin Calibration
  contractAddresses: {
    manager: "0x...",
    fileRegistry: "0x...",
    keyRegistry: "0x..."
  }
});
```

### Encryption Settings
```typescript
const client = new FilosignClient(walletClient, {
  encryption: {
    algorithm: "AES-GCM",
    keyLength: 256,
    ivLength: 12
  }
});
```

## Examples

### Complete Document Signing Flow

```typescript
// Sender workflow
const client = new FilosignClient(senderWallet);
await client.initialize();
await client.login("sender-pin");

// Upload document to IPFS/Filecoin
const cid = await uploadToIPFS(documentData);

// Register for signing
await client.registerDocument(cid, recipientAddress);

// Recipient workflow
const recipientClient = new FilosignClient(recipientWallet);
await recipientClient.initialize();
await recipientClient.login("recipient-pin");

// Acknowledge receipt
await recipientClient.acknowledgeDocument(cidIdentifier);

// Sign document
const signatureData = await createSignature(documentData);
await recipientClient.submitSignature(cidIdentifier, signatureData);
```

### Secure Document Exchange

```typescript
// Encrypt document for recipient
const { encrypted, iv } = await senderClient.encryptDocument(
  documentData,
  recipientAddress
);

// Send encrypted data + IV to recipient

// Recipient decrypts
const decrypted = await recipientClient.decryptDocument(
  encrypted,
  iv,
  senderAddress
);
```

## Error Handling

```typescript
try {
  await client.register("weak-pin");
} catch (error) {
  if (error.code === "ALREADY_REGISTERED") {
    console.log("User already registered");
  } else if (error.code === "INVALID_PIN") {
    console.log("PIN validation failed");
  }
}
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

AGPL-3.0-or-later
