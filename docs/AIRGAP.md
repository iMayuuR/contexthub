# ContextHub Airgap & Security Architecture

ContextHub is architected specifically for high-security, completely offline, and airgapped enterprise environments.

## 1. 100% Offline by Design
Unlike standard tools that require API access to OpenAI, Anthropic, or external vector databases, ContextHub executes completely on your local workstation:
- **Local Bigram Embeddings**: Semantic text vector spaces are computed deterministically using optimized local bigram term-frequency algorithms without any internet connection.
- **Offline Verified Semantic Search**: Our bigram TF-IDF similarity matcher is fully offline verified (P6) to return extremely high-precision conceptual hits across 5-10 seeded memories with zero network dependencies.
- **Xenova Option**: Even if using advanced transformer architectures, the models are lazy-loaded and cached locally on the disk.
- **Zero API Keys**: No API key is ever requested, stored, or transmitted.

## 2. Hardened Data Security & Cryptography
- **AES-256-GCM Encryption**: All auto-memories (agent interactions, prompt/response summaries, and metadata) are encrypted locally using industrial-grade AES-256-GCM.
- **Strict File Permissions**:
  - The `.contexthub` directory is locked down with strict directory permissions (`0700` / owner-only access).
  - The `.keyfile` encryption key is written with `0600` permissions.
- **Key Derivation (PBKDF2/Scrypt)**: Keys are derived securely, avoiding plaintext credentials or insecure storage vectors.

## 3. Secure CI/CD Practices
- **No Secrets Leaked**: The CI/CD integration (`contexthub ci`) and PR commenter only read structural graph paths and symbol relationships. No secure memory content or decryption keys are ever printed or transmitted to comments.
- **Local Compliance**: Fully compliant with airgapped enterprise servers.
