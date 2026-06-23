#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/native/audio-host/build"
CONFIG="${1:-Debug}"

cmake -S "$ROOT/native/audio-host" -B "$BUILD_DIR" -G "Unix Makefiles" -DCMAKE_BUILD_TYPE="$CONFIG"
cmake --build "$BUILD_DIR" --config "$CONFIG" --target audio-host

BINARY="$BUILD_DIR/audio-host_artefacts/$CONFIG/audio-host"
if [[ ! -x "$BINARY" ]]; then
  echo "Expected binary not found: $BINARY" >&2
  exit 1
fi

echo "$BINARY"
