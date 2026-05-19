#!/bin/bash
set -e

echo "Running ContextHub Smoke Test..."

# Create a temporary directory for the test
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"

# Ensure we cleanup on exit
cleanup() {
  echo "Cleaning up test directory..."
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Copy the CLI to execute it locally
# Assuming this script is run from the root of the contexthub repo
CLI_BIN="$(pwd)/packages/cli/dist/index.js"

if [ ! -f "$CLI_BIN" ]; then
  echo "Error: CLI binary not found at $CLI_BIN. Did you run npm run build?"
  exit 1
fi

cd "$TEST_DIR"

# Initialize a git repo (required for some ContextHub features)
git init --quiet
echo "Test File" > README.md
git add README.md
git commit -m "Initial commit" --quiet

# Run setup (this will initialize ContextHub and install skills)
echo "Running contexthub setup..."
node "$CLI_BIN" setup

if [ ! -d ".contexthub" ]; then
  echo "Error: .contexthub directory was not created."
  exit 1
fi

# Add a memory
echo "Adding memory..."
node "$CLI_BIN" memory --add "Smoke test memory entry"

# List memories
echo "Listing memories..."
MEMORIES=$(node "$CLI_BIN" memory --list)
if ! echo "$MEMORIES" | grep -q "Smoke test memory entry"; then
  echo "Error: Memory was not saved or listed properly."
  echo "Output: $MEMORIES"
  exit 1
fi

# Run ingest docs
echo "Ingesting docs..."
node "$CLI_BIN" ingest-docs

# Test query
echo "Testing unified query..."
QUERY_OUT=$(node "$CLI_BIN" query "Smoke test")
if ! echo "$QUERY_OUT" | grep -qi "smoke test"; then
  echo "Error: Query did not return expected results."
  echo "Output: $QUERY_OUT"
  exit 1
fi

echo "✅ Smoke test completed successfully!"
