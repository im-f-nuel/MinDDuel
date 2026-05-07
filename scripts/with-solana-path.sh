#!/usr/bin/env bash
# Helper to ensure Solana + Anchor toolchain are on PATH inside WSL.
# Sources interactive shell rc, then prepends Solana install bin.
set -e
SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
if [ -d "$SOLANA_BIN" ]; then
  export PATH="$SOLANA_BIN:$PATH"
fi
if [ -d "$HOME/.cargo/bin" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi
if [ -d "$HOME/.avm/bin" ]; then
  export PATH="$HOME/.avm/bin:$PATH"
fi
exec "$@"
