#!/bin/sh

# Installs the MeaWallet push provisioning SDK (@meawallet/react-native-mpp) and its
# configuration where this machine has access to them, and removes them everywhere else.
#
# The package lives in MeaWallet's private registry, so it is kept out of package.json:
# an install without access would fail for every contributor and CI job. Here it is
# vendored to vendor/meawallet/react-native-mpp, which react-native.config.js links and
# metro.config.js resolves only when present. Without it the app builds the same and no
# card is offered to a device wallet.
#
# Credentials: MEA_RN_USER and MEA_RN_PASSWORD, or the same two keys in
# $MEA_CONFIG_DIR/meawallet-rn.env. Configuration: the mea_config file Rain shared, from
# $MEA_CONFIG_FILE or $MEA_CONFIG_DIR/mea_config. MEA_CONFIG_DIR defaults to
# ~/.config/blink. No credential is ever printed.
#
# Each run converges on what this machine has now. The SDK and its configuration are
# installed together or not at all: an SDK without its configuration fails to start, and
# a configuration without the SDK is a pod that does nothing. So without the credentials
# or without the configuration both are removed, and access that was revoked or a
# configuration that was withdrawn never lingers in a build. A vendored SDK is reused
# only while it carries the marker written once its archive matched the pinned checksum,
# so a partial, corrupt or restored copy is downloaded again, and a copy a run could not
# verify is removed, since the build links whatever is vendored.

set -eu

MPP_VERSION="2.5.0"
MPP_INTEGRITY="wIxgYe0g5um99WkcmTfYNbL0t7oBi7JUCcg8l1+PD4CoT4wVo0GWIExlG68FuAmyKMU5IWNlbhvlOqvqtXaVgg=="
MPP_TARBALL="https://nexus.ext.meawallet.com/repository/react-native-mpp/@meawallet/react-native-mpp/-/react-native-mpp-${MPP_VERSION}.tgz"

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VENDOR_DIR="$ROOT/vendor/meawallet/react-native-mpp"
INTEGRITY_MARKER="$VENDOR_DIR/.integrity"
CONFIG_DIR="${MEA_CONFIG_DIR:-$HOME/.config/blink}"
CONFIG_FILE="${MEA_CONFIG_FILE:-$CONFIG_DIR/mea_config}"
CREDENTIALS_FILE="$CONFIG_DIR/meawallet-rn.env"
ANDROID_CONFIG="$ROOT/android/app/src/main/res/raw/mea_config"
IOS_CONFIG="$ROOT/ios/MeaConfig/mea_config"

work=""
staging=""

log() {
  echo "[meawallet] $*"
}

# One cleanup for every way out: a clean exit, a failure, or a Ctrl-C on a slow yarn
# install. dash, Linux's /bin/sh, runs no EXIT trap when a signal ends it, so the signals
# are trapped too, and leave with the status a shell gives them.
cleanup() {
  if [ -n "$work" ]; then rm -rf "$work"; fi
  if [ -n "$staging" ]; then rm -rf "$staging"; fi
}
trap cleanup EXIT
trap 'cleanup; exit 129' HUP
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

# Escapes a value for a double-quoted string in a curl config. printf is a shell builtin,
# so the value never reaches a process's arguments; sed reads it on stdin.
curl_config_quote() {
  printf '%s' "$1" | sed 's/[\\"]/\\&/g'
}

# A completion marker, written last once the archive matched the pinned checksum: it tells
# an install that finished from one cut short. It is not tamper evidence for the files.
has_completed_install() {
  [ -f "$INTEGRITY_MARKER" ] && [ "$(cat "$INTEGRITY_MARKER")" = "$MPP_INTEGRITY" ]
}

# The environment wins per variable, as CI passes it, and the file fills whichever one it
# left unset: a shell that exports only the user still reads the password from the file.
load_credentials() {
  env_user="${MEA_RN_USER:-}"
  env_password="${MEA_RN_PASSWORD:-}"
  if [ -f "$CREDENTIALS_FILE" ] && { [ -z "$env_user" ] || [ -z "$env_password" ]; }; then
    # shellcheck disable=SC1090
    . "$CREDENTIALS_FILE"
  fi
  MEA_RN_USER="${env_user:-${MEA_RN_USER:-}}"
  MEA_RN_PASSWORD="${env_password:-${MEA_RN_PASSWORD:-}}"
}

remove_sdk_and_config() {
  rm -rf "$VENDOR_DIR"
  rm -f "$ANDROID_CONFIG" "$IOS_CONFIG"
}

go_without() {
  remove_sdk_and_config
  log "$1, the build goes without the push provisioning SDK"
  exit 0
}

install_config() {
  mkdir -p "$(dirname "$ANDROID_CONFIG")" "$(dirname "$IOS_CONFIG")"
  cp "$CONFIG_FILE" "$ANDROID_CONFIG"
  cp "$CONFIG_FILE" "$IOS_CONFIG"
  log "mea_config installed for Android and iOS"
}

install_package() {
  if has_completed_install; then
    log "@meawallet/react-native-mpp $MPP_VERSION already vendored"
    return 0
  fi

  # A template, since macOS's mktemp ignores TMPDIR without one.
  work=$(mktemp -d "${TMPDIR:-/tmp}/meawallet-mpp.XXXXXX")
  # The credentials reach curl on its stdin, never its arguments or a file that a killed
  # install could leave behind. The configs link whatever is vendored, so a copy this run
  # could not verify is removed, with its configuration, rather than left for the next
  # build to pick up.
  user=$(curl_config_quote "$MEA_RN_USER")
  password=$(curl_config_quote "$MEA_RN_PASSWORD")
  if ! printf 'user = "%s:%s"\n' "$user" "$password" |
    curl -K - -sSf -o "$work/package.tgz" "$MPP_TARBALL"; then
    remove_sdk_and_config
    log "could not download @meawallet/react-native-mpp $MPP_VERSION"
    return 1
  fi

  integrity=$(openssl dgst -sha512 -binary "$work/package.tgz" | openssl base64 -A)
  if [ "$integrity" != "$MPP_INTEGRITY" ]; then
    remove_sdk_and_config
    log "integrity mismatch for @meawallet/react-native-mpp $MPP_VERSION, not installing it"
    return 1
  fi

  # Extracted beside its destination so the swap is a rename, and marked last, so an
  # install cut short anywhere leaves a copy the next run does not trust.
  mkdir -p "$(dirname "$VENDOR_DIR")"
  staging=$(mktemp -d "$(dirname "$VENDOR_DIR")/.staging.XXXXXX")
  tar -xzf "$work/package.tgz" -C "$staging"
  rm -rf "$VENDOR_DIR"
  mv "$staging/package" "$VENDOR_DIR"
  printf '%s\n' "$MPP_INTEGRITY" > "$INTEGRITY_MARKER"
  log "@meawallet/react-native-mpp $MPP_VERSION vendored"
}

load_credentials
if [ -z "$MEA_RN_USER" ] || [ -z "$MEA_RN_PASSWORD" ]; then
  go_without "no MeaWallet credentials"
fi
if [ ! -s "$CONFIG_FILE" ]; then
  go_without "no mea_config found"
fi
install_package
install_config
