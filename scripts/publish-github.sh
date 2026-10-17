#!/usr/bin/env bash
# 把「閱讀器」從上層的 專案/ repo 抽出來推到 GitHub（tcy311/polyglot-reader）。
# - 只保留 閱讀器/ 的檔案與歷史，不含其他專案
# - 作者／提交者 email 一律換成 GitHub 的 noreply，避免公開個人信箱
# - 改寫結果是確定的（保留原本的時間），之後再發布只會在後面接上新 commit，不需要 force push
# 用法：scripts/publish-github.sh [--dry-run]
set -euo pipefail

PREFIX="閱讀器"
REMOTE="https://github.com/tcy311/polyglot-reader.git"
NOREPLY="276561655+tcy311@users.noreply.github.com"
NAME="tcy311"

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "→ 複製 $ROOT（不影響原本的 repo）"
git clone --quiet --no-local --branch main "$ROOT" "$WORK/repo"
cd "$WORK/repo"

echo "→ 只保留 $PREFIX/，並改用 noreply email"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch \
  --subdirectory-filter "$PREFIX" \
  --env-filter "
    export GIT_AUTHOR_NAME='$NAME' GIT_AUTHOR_EMAIL='$NOREPLY'
    export GIT_COMMITTER_NAME='$NAME' GIT_COMMITTER_EMAIL='$NOREPLY'
  " -- main >/dev/null

echo "→ 檢查：歷史中不得出現個人 email 或疑似金鑰"
if git log --format='%ae%n%ce%n%B' main | grep -qiE '@gmail\.com'; then
  echo "✗ commit 資訊仍含個人 email，中止" >&2; exit 1
fi
if git grep -qE 'AIza[0-9A-Za-z_-]{35}|BEGIN [A-Z ]*PRIVATE KEY' $(git rev-list main); then
  echo "✗ 歷史中有疑似金鑰，中止" >&2; exit 1
fi
echo "  通過（$(git rev-list --count main) 個 commit）"

if [[ "${1:-}" == "--dry-run" ]]; then
  git log --format='  %h %ae %s' main
  echo "（--dry-run：不推送）"
  exit 0
fi

echo "→ 推送到 $REMOTE"
git push "$REMOTE" main:main
