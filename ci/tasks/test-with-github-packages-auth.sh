#!/bin/bash

# Tests for with-github-packages-auth.sh, and for install-deps.sh keeping its token out of
# the deps bundle. TEST_SHELL runs the wrapper under a given sh instead of its shebang's,
# e.g. TEST_SHELL="bash --posix" for the /bin/sh of the macOS build worker.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WRAPPER="${SCRIPT_DIR}/with-github-packages-auth.sh"

TOKEN="ghp_fakeTokenForTheseTests0123456789"
TOKEN_LINE="//npm.pkg.github.com/:_authToken=${TOKEN}"
MISSING_TOKEN_WARNING="GITHUB_PACKAGES_TOKEN not set, @blinkbitcoin installs will fail with 401"

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

PASSED=0
FAILED=0

assert_eq() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $test_name"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL: $test_name"
    echo "    expected: $(echo -n "$expected" | head -c 200)"
    echo "    actual:   $(echo -n "$actual" | head -c 200)"
    FAILED=$((FAILED + 1))
  fi
}

# A fresh home and a probe command, which records what the wrapped command sees and exits
# with PROBE_EXIT.
new_case() {
  WORK="$(mktemp -d "${TEST_ROOT}/case.XXXXXX")"
  mkdir "${WORK}/home"
  NPMRC="${WORK}/github-packages.npmrc"
  PROBE="${WORK}/probe.sh"
  cat > "$PROBE" <<'EOF'
#!/bin/sh
printf '%s' "${NPM_CONFIG_USERCONFIG:-}" > "${PROBE_OUT}.path"
if [ -n "${NPM_CONFIG_USERCONFIG:-}" ]; then
  cat "$NPM_CONFIG_USERCONFIG" > "${PROBE_OUT}.content"
  (stat -c %a "$NPM_CONFIG_USERCONFIG" 2>/dev/null || stat -f %Lp "$NPM_CONFIG_USERCONFIG") > "${PROBE_OUT}.mode"
fi
exit "${PROBE_EXIT:-0}"
EOF
  chmod +x "$PROBE"
}

# Runs the wrapper with the case's home, the token unless told to leave it unset, and the
# given arguments; leaves its exit status in STATUS and its stderr in STDERR.
run_wrapper() {
  local token_env=(GITHUB_PACKAGES_TOKEN="$TOKEN")
  if [[ "${WITHOUT_TOKEN:-}" == "true" ]]; then
    token_env=(-u GITHUB_PACKAGES_TOKEN)
  fi
  STATUS=0
  # shellcheck disable=SC2086 # TEST_SHELL may carry flags, such as "bash --posix".
  STDERR="$(env -u NPM_CONFIG_USERCONFIG "${token_env[@]}" HOME="${WORK}/home" PROBE_OUT="${WORK}/seen" \
    PROBE_EXIT="${PROBE_EXIT:-0}" ${TEST_SHELL:-} "$WRAPPER" "$@" 2>&1 >/dev/null)" ||
    STATUS=$?
}

seen() {
  cat "${WORK}/seen.$1" 2>/dev/null
}

test_without_token_warns_and_still_runs_the_command() {
  new_case
  WITHOUT_TOKEN=true run_wrapper "$NPMRC" "$PROBE"
  assert_eq "warns that installs will fail" "$MISSING_TOKEN_WARNING" "$STDERR"
  assert_eq "exits with the command's status" "0" "$STATUS"
  assert_eq "runs the command" "true" "$([[ -e "${WORK}/seen.path" ]] && echo true || echo false)"
  assert_eq "the command ran with no npmrc of its own" "" "$(seen path)"
  assert_eq "writes no npmrc" "false" "$([[ -e "$NPMRC" ]] && echo true || echo false)"
}

test_without_token_keeps_a_failing_command_status() {
  new_case
  WITHOUT_TOKEN=true PROBE_EXIT=3 run_wrapper "$NPMRC" "$PROBE"
  assert_eq "exits with the failing command's status" "3" "$STATUS"
}

test_hands_the_token_to_the_command_only() {
  new_case
  run_wrapper "$NPMRC" "$PROBE"
  assert_eq "says nothing when the token is set" "" "$STDERR"
  assert_eq "the command reads the build's npmrc" "$NPMRC" "$(seen path)"
  assert_eq "the npmrc carries the token" "$TOKEN_LINE" "$(grep -x -- "$TOKEN_LINE" "${WORK}/seen.content")"
  assert_eq "only its owner can read it" "600" "$(seen mode)"
  assert_eq "the user's npmrc is left alone" "false" "$([[ -e "${WORK}/home/.npmrc" ]] && echo true || echo false)"
}

test_carries_over_an_npmrc_ending_in_a_newline() {
  new_case
  printf 'fund=false\n' > "${WORK}/home/.npmrc"
  run_wrapper "$NPMRC" "$PROBE"
  assert_eq "keeps the user's settings, then the token" \
    "$(printf 'fund=false\n\n%s' "$TOKEN_LINE")" "$(seen content)"
}

test_keeps_an_npmrc_without_a_trailing_newline_apart_from_the_token() {
  new_case
  printf 'fund=false' > "${WORK}/home/.npmrc"
  run_wrapper "$NPMRC" "$PROBE"
  assert_eq "the user's last setting stays on its own line" \
    "$(printf 'fund=false\n%s' "$TOKEN_LINE")" "$(seen content)"
}

test_removes_the_npmrc_once_the_command_succeeds() {
  new_case
  run_wrapper "$NPMRC" "$PROBE"
  assert_eq "exits with the command's status" "0" "$STATUS"
  assert_eq "the npmrc is gone" "false" "$([[ -e "$NPMRC" ]] && echo true || echo false)"
}

test_removes_the_npmrc_once_the_command_fails() {
  new_case
  PROBE_EXIT=3 run_wrapper "$NPMRC" "$PROBE"
  assert_eq "exits with the failing command's status" "3" "$STATUS"
  assert_eq "the npmrc is gone" "false" "$([[ -e "$NPMRC" ]] && echo true || echo false)"
}

test_removes_the_npmrc_when_terminated() {
  new_case
  # The command stops the wrapper, as an aborted build does.
  # shellcheck disable=SC2016 # $PPID is the inner sh's to expand: the wrapper.
  run_wrapper "$NPMRC" sh -c 'kill -TERM "$PPID"; sleep 1'
  assert_eq "exits as terminated" "143" "$STATUS"
  assert_eq "the npmrc is gone" "false" "$([[ -e "$NPMRC" ]] && echo true || echo false)"
}

test_refuses_to_run_without_a_command() {
  new_case
  run_wrapper "$NPMRC"
  assert_eq "exits as misused" "2" "$STATUS"
  assert_eq "says how to call it" "Usage:" "${STDERR:0:6}"
}

# install-deps.sh on a stand-in for its task directory, with a yarn that only records the
# npmrc it was handed and writes a node_modules, and a git and tar, the commands that run
# after it, that record the token they inherit before doing their own work.
test_install_deps_gives_the_token_to_the_install_alone() {
  new_case
  local task="${WORK}/task"
  mkdir -p "${task}/deps" "${task}/deps-version" "${task}/bundled-deps" "${WORK}/bin"
  ln -s "$REPO_ROOT" "${task}/pipeline-tasks"
  echo "1.2.3" > "${task}/deps-version/number"
  echo '{"name":"deps"}' > "${task}/deps/package.json"
  git -C "${task}/deps" init -q
  git -C "${task}/deps" add package.json
  git -C "${task}/deps" -c user.email=ci@example.com -c user.name=CI commit -q -m deps

  cat > "${WORK}/bin/yarn" <<EOF
#!/bin/sh
cat "\$NPM_CONFIG_USERCONFIG" > "${WORK}/yarn-saw"
mkdir -p node_modules
echo installed > node_modules/.yarn-integrity
EOF
  chmod +x "${WORK}/bin/yarn"

  local tool
  for tool in git tar; do
    cat > "${WORK}/bin/${tool}" <<EOF
#!/bin/sh
echo "${tool}:\${GITHUB_PACKAGES_TOKEN:-}" >> "${WORK}/after-install"
exec "$(command -v "$tool")" "\$@"
EOF
    chmod +x "${WORK}/bin/${tool}"
  done

  local status=0
  (cd "$task" && env GITHUB_PACKAGES_TOKEN="$TOKEN" HOME="${WORK}/home" \
    PATH="${WORK}/bin:${PATH}" bash pipeline-tasks/ci/tasks/install-deps.sh > /dev/null 2>&1) ||
    status=$?
  assert_eq "install-deps succeeds" "0" "$status"
  assert_eq "yarn was handed the token" "$TOKEN_LINE" "$(grep -x -- "$TOKEN_LINE" "${WORK}/yarn-saw")"
  assert_eq "no command after the install inherits the token" \
    "$(printf 'git:\ntar:')" "$(cat "${WORK}/after-install")"

  local bundle unpacked="${WORK}/unpacked"
  bundle="$(ls "${task}"/bundled-deps/bundled-deps-v1.2.3-*.tgz)"
  mkdir "$unpacked"
  tar -xzf "$bundle" -C "$unpacked"
  assert_eq "the bundle holds the install" "installed" "$(cat "${unpacked}/node_modules/.yarn-integrity")"
  assert_eq "the token is nowhere in the bundle" "" "$(grep -rl -- "$TOKEN" "$unpacked")"
  assert_eq "the npmrc is gone from the task" "false" \
    "$([[ -e "${task}/github-packages.npmrc" ]] && echo true || echo false)"
}

echo "=== with-github-packages-auth.sh${TEST_SHELL:+ (under ${TEST_SHELL})}"

test_without_token_warns_and_still_runs_the_command
test_without_token_keeps_a_failing_command_status
test_hands_the_token_to_the_command_only
test_carries_over_an_npmrc_ending_in_a_newline
test_keeps_an_npmrc_without_a_trailing_newline_apart_from_the_token
test_removes_the_npmrc_once_the_command_succeeds
test_removes_the_npmrc_once_the_command_fails
test_removes_the_npmrc_when_terminated
test_refuses_to_run_without_a_command

echo "=== install-deps.sh"

test_install_deps_gives_the_token_to_the_install_alone

echo ""
echo "Results: $PASSED passed, $FAILED failed"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
