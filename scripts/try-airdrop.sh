#!/usr/bin/env bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin"
WALLET="CPoofbZho4bJmSAyVJxfeMK9CoZpXpDYftctghwUJX86"
URLS=(
  "https://api.devnet.solana.com"
  "https://devnet.helius-rpc.com"
  "https://rpc.ankr.com/solana_devnet"
)
for url in "${URLS[@]}"; do
  echo "==> Trying airdrop via $url"
  for amount in 2 1 0.5; do
    solana airdrop "$amount" "$WALLET" --url "$url" 2>&1 | tail -n 2
    sleep 2
  done
done
echo
echo "Final balance:"
solana balance "$WALLET" --url "https://api.devnet.solana.com"
