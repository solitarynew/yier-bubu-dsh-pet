#!/bin/zsh
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 22.12 或更新的 LTS 版本：https://nodejs.org/"
  read -r "?按回车退出。"
  exit 1
fi
if ! node scripts/install.mjs "$@"; then
  read -r "?启动失败，请查看上方错误；按回车退出。"
  exit 1
fi
