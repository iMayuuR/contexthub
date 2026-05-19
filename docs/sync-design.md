# Cloud Sync Design (Draft)

> **Status:** Discovery / Design Only
> **Target Version:** TBD

ContextHub is built as a local-first memory store. However, as teams adopt AI agents, the need to securely share architectural decisions and repository knowledge across machines becomes critical. This document outlines the proposed design for a future cloud-sync capability.

## 1. Non-Goals (v1)
- **No Central ContextHub Server**: We will not host a centralized SaaS platform for v1 sync. Users must bring their own storage (S3, GCS, or generic WebDAV).
- **No Real-Time Collaborative Editing**: Sync is meant for asynchronous memory sharing, not real-time concurrent Google Docs-style editing of a single memory.
- **No Plaintext Sync**: Unencrypted payloads will never leave the local machine.

## 2. Threat Model
- **Compromised Cloud Storage**: If the S3 bucket is public or compromised, the attacker only sees opaque binary blobs.
- **Man-in-the-Middle (MitM)**: All transport is over TLS, but even if intercepted, payload is AES-256-GCM encrypted.
- **Malicious Team Member**: Anyone with the shared repository key can decrypt the blobs. Key rotation requires re-encrypting the entire history (handled out of scope for v1).

## 3. End-to-End Encrypted Blob Format
All data synced to the remote backend is encapsulated in a secure blob format.

```typescript
interface SyncBlob {
  version: "1.0";
  repoId: string;       // SHA-256 hash of the git origin URL (anonymized)
  timestamp: number;    // Unix epoch
  author: string;       // git config user.email (encrypted within payload? No, useful for conflict resolution)
  iv: string;           // 12-byte initialization vector (base64)
  authTag: string;      // 16-byte GCM authentication tag (base64)
  payload: string;      // Ciphertext (base64) containing memories and metadata
}
```

The `payload` decrypts to an array of `MemoryEntry` operations (upserts and deletes).

## 4. Conflict Resolution
Since sync is asynchronous, concurrent edits to the same memory ID may occur.
- **Vector Clock / Timestamp**: We use a Last-Write-Wins (LWW) strategy based on the `updatedAt` timestamp of the individual memory.
- **Immutable Updates**: Memories are highly append-only by nature. Agents typically create new memories rather than updating old ones.
- **Graph Conflicts**: The `code-graph.json` is **not** synced. The graph is strictly a derivative of the local codebase and is rebuilt/patched locally.

## 5. What Syncs (Scope)
- **Synced**: `memories.json` (prompt, response, summary, decision, bugfix, manual).
- **Synced**: `project-metadata.json` (if it contains shared prompt instructions).
- **NOT Synced**: `sessions.json` (local agent chat history).
- **NOT Synced**: `code-graph.json` (rebuilt locally).
- **NOT Synced**: `embeddings/` (re-computed locally to ensure exact model match and save bandwidth).
- **NOT Synced**: `.keyfile` and `.auth-token` (these must be securely shared out-of-band, e.g., via 1Password).

## 6. Sync Workflow
1. **Push**:
   - Agent generates a new memory.
   - ContextHub bundles unsynced memories since the last sync cursor.
   - Encrypts payload with the shared repo `.keyfile`.
   - Uploads `SyncBlob` to remote storage at `/<repoId>/<timestamp>-<authorHash>.blob`.
2. **Pull**:
   - `contexthub sync` or background daemon lists new blobs in `/<repoId>/`.
   - Downloads blobs > local sync cursor.
   - Decrypts and applies LWW resolution to `memories.json`.
   - Re-runs local embedding generation for new memories.
