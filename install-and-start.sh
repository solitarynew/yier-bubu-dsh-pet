#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo '请先安装 Node.js 22.12 或更新的 LTS 版本：https://nodejs.org/' >&2
  exit 1
fi
exec node scripts/install.mjs "$@"
