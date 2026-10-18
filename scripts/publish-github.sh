#!/usr/bin/env bash
# 把「閱讀器」從上層的 專案/ repo 抽出來推到 GitHub（tccccy/tapread）。
# - 只保留 閱讀器/ 的檔案與歷史，不含其他專案
# - 作者／提交者 email 一律換成 GitHub 的 noreply，避免公開個人信箱
# - 拿掉 commit 訊息中 AI 工具的 Co-Authored-By 署名，GitHub 上不留紀錄
# - 改寫結果是確定的（保留原本的時間），之後再發布只會在後面接上新 commit，不需要 force push
#   （改了改寫規則時，第一次要加 --force 覆蓋 GitHub 上的舊歷史）
# 用法：scripts/publish-github.sh [--dry-run | --force]
set -euo pipefail

PREFIX="閱讀器"
REMOTE="https://github.com/tccccy/tapread.git"
NOREPLY="276561655+tccccy@users.noreply.github.com"
NAME="tccccy"

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

echo "→ 複製 ${ROOT}（不影響原本的 repo）"
git clone --quiet --no-local --branch main "${ROOT}" "${WORK}/repo"
cd "${WORK}/repo"

echo "→ 只保留 ${PREFIX}/，改用 noreply email，拿掉 AI 署名"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch \
  --subdirectory-filter "${PREFIX}" \
  --msg-filter "perl -0777 -pe 's/^co-authored-by:[^\\n]*(?:claude|anthropic)[^\\n]*\\n?//gim; s/\\s+\\z/\\n/'" \
  --env-filter "
    export GIT_AUTHOR_NAME='${NAME}' GIT_AUTHOR_EMAIL='${NOREPLY}'
    export GIT_COMMITTER_NAME='${NAME}' GIT_COMMITTER_EMAIL='${NOREPLY}'
  " -- main >/dev/null

echo "→ 檢查：歷史中不得出現個人 email 或疑似金鑰"
if git log --format='%ae%n%ce%n%B' main | grep -qiE '@gmail\.com'; then
  echo "✗ commit 資訊仍含個人 email，中止" >&2; exit 1
fi
if git log --format='%B' main | grep -qiE '^co-authored-by:.*(claude|anthropic)'; then
  echo "✗ commit 訊息仍有 AI 署名，中止" >&2; exit 1
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

echo "→ 推送到 ${REMOTE}"
if [[ "${1:-}" == "--force" ]]; then
  git push --force "${REMOTE}" main:main
else
  git push "${REMOTE}" main:main
fi
