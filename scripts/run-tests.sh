#!/usr/bin/env bash
# Run smart-contract tests against a fresh local solana-test-validator
# preloaded with the deployed program binary. Auto-cleanup on exit.
set -euo pipefail

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROGRAM_ID="8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN"
SO_PATH="$REPO_ROOT/target/deploy/mind_duel.so"
LEDGER_DIR="$REPO_ROOT/.test-ledger"
RPC_PORT=8899
FAUCET_PORT=9900

if [[ ! -f "$SO_PATH" ]]; then
  echo "Program binary not found at $SO_PATH. Run 'cargo build-sbf' first." >&2
  exit 1
fi

# Kill any pre-existing validator
pkill -f "solana-test-validator" || true
rm -rf "$LEDGER_DIR"

echo "==> Starting solana-test-validator on port $RPC_PORT"
solana-test-validator \
  --bpf-program "$PROGRAM_ID" "$SO_PATH" \
  --ledger "$LEDGER_DIR" \
  --rpc-port "$RPC_PORT" \
  --faucet-port "$FAUCET_PORT" \
  --reset \
  --quiet > "$LEDGER_DIR.log" 2>&1 &
VALIDATOR_PID=$!

cleanup() {
  echo "==> Cleaning up validator (PID $VALIDATOR_PID)"
  kill "$VALIDATOR_PID" 2>/dev/null || true
  wait "$VALIDATOR_PID" 2>/dev/null || true
  rm -rf "$LEDGER_DIR" "$LEDGER_DIR.log"
}
trap cleanup EXIT

# Wait for validator to be ready
echo "==> Waiting for validator..."
for i in {1..40}; do
  if solana cluster-version --url "http://127.0.0.1:$RPC_PORT" &>/dev/null; then
    echo "==> Validator ready"
    break
  fi
  sleep 0.5
  if [[ $i -eq 40 ]]; then
    echo "Validator failed to start" >&2
    cat "$LEDGER_DIR.log" >&2 || true
    exit 1
  fi
done

# Verify program is loaded
solana program show "$PROGRAM_ID" --url "http://127.0.0.1:$RPC_PORT" || {
  echo "Program not loaded" >&2
  exit 1
}

echo "==> Validator running. Tests should be invoked from Windows side."
echo "==> Press Ctrl+C to stop validator when done."
wait "$VALIDATOR_PID"
