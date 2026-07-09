#!/usr/bin/env bash
# Contrôle de cohérence idempotente des migrations Flora.
set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
errors=0

fail() {
  echo "FAIL: $1"
  errors=$((errors + 1))
}

pass() {
  echo "OK: $1"
}

echo "=== Flora migrations idempotency audit ==="
echo "Directory: $MIGRATIONS_DIR"
echo

files=()
while IFS= read -r f; do
  files+=("$f")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | sort)
if ((${#files[@]} == 0)); then
  fail "No migration files found"
  exit 1
fi

# Helpers must be first.
first="$(basename "${files[0]}")"
if [[ "$first" != 00000000000000_flora_idempotent_helpers.sql ]]; then
  fail "First migration must be 00000000000000_flora_idempotent_helpers.sql (found $first)"
else
  pass "Helpers migration is first"
fi

for file in "${files[@]}"; do
  base="$(basename "$file")"
  content="$(cat "$file")"

  if [[ "$base" == 00000000000000_flora_idempotent_helpers.sql ]]; then
    continue
  fi

  # Tables
  if echo "$content" | grep -Eiq 'create table public\.'; then
    fail "$base: bare CREATE TABLE without IF NOT EXISTS"
  else
    pass "$base: CREATE TABLE IF NOT EXISTS"
  fi

  # Indexes (outside helpers file)
  if echo "$content" | grep -Eiq '^[[:space:]]*create index '; then
    fail "$base: direct CREATE INDEX found (use flora_create_* helpers)"
  fi

  if echo "$content" | grep -q 'flora_create_'; then
    if ! grep -q '00000000000000_flora_idempotent_helpers' <<< "${files[*]}"; then
      fail "$base: uses flora helpers but helpers migration missing"
    fi
  fi

  # Policies
  policy_count=$(grep -Eic 'create policy' "$file" || true)
  drop_count=$(grep -Eic 'drop policy if exists' "$file" || true)
  if (( policy_count > 0 && drop_count < policy_count )); then
    fail "$base: CREATE POLICY without matching DROP POLICY IF EXISTS ($drop_count drops vs $policy_count creates)"
  elif (( policy_count > 0 )); then
    pass "$base: RLS policies protected ($policy_count)"
  fi

  # ADD COLUMN coverage for alter-able module tables
  if echo "$content" | grep -q 'create table if not exists public\.'; then
    if ! echo "$content" | grep -q 'add column if not exists'; then
      fail "$base: tables defined but no ADD COLUMN IF NOT EXISTS blocks"
    else
      pass "$base: ADD COLUMN IF NOT EXISTS present"
    fi
  fi
done

# Dependency order: documents before knowledge
docs_idx=-1
know_idx=-1
for i in "${!files[@]}"; do
  base="$(basename "${files[$i]}")"
  [[ "$base" == *documents* ]] && docs_idx=$i
  [[ "$base" == *knowledge* ]] && know_idx=$i
done
if (( docs_idx >= 0 && know_idx >= 0 && docs_idx > know_idx )); then
  fail "documents_module must run before knowledge_engine"
else
  pass "documents → knowledge order"
fi

echo
if (( errors > 0 )); then
  echo "=== Audit finished with $errors error(s) ==="
  exit 1
fi

echo "=== Audit passed (${#files[@]} migrations) ==="
