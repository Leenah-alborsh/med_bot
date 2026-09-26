#!/bin/sh
set -eu

: "${TELEGRAM_API_ID:?TELEGRAM_API_ID is required}"
: "${TELEGRAM_API_HASH:?TELEGRAM_API_HASH is required}"

data_dir=/var/lib/telegram-bot-api
mkdir -p "$data_dir/temp"
chown -R telegram-bot-api:telegram-bot-api "$data_dir"

exec gosu telegram-bot-api telegram-bot-api \
  --local \
  --http-ip-address=0.0.0.0 \
  --http-port="${PORT:-10000}" \
  --dir="$data_dir" \
  --temp-dir="$data_dir/temp"
