#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
src="${repo_root}/.githooks/pre-commit"
dst="${repo_root}/.git/hooks/pre-commit"

if [ ! -f "$src" ]; then
  echo "找不到 hook 檔案：$src"
  exit 1
fi

cp "$src" "$dst"
chmod +x "$dst"

echo "✅ 已安裝 pre-commit hook"
echo "   每次 commit 前，若有 .md 變更會自動快照到 docs/_snapshots/<timestamp>/"
