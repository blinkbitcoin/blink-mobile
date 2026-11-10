#!/bin/sh

# Installs the MeaWallet push provisioning SDK (@meawallet/react-native-mpp) and its
# configuration where this machine has access to them, and skips them everywhere else.
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

set -eu

MPP_VERSION="2.5.0"
MPP_INTEGRITY="wIxgYe0g5um99WkcmTfYNbL0t7oBi7JUCcg8l1+PD4CoT4wVo0GWIExlG68FuAmyKMU5IWNlbhvlOqvqtXaVgg=="
MPP_TARBALL="https://nexus.ext.meawallet.com/repository/react-native-mpp/@meawallet/react-native-mpp/-/react-native-mpp-${MPP_VERSION}.tgz"

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VENDOR_DIR="$ROOT/vendor/meawallet/react-native-mpp"
CONFIG_DIR="${MEA_CONFIG_DIR:-$HOME/.config/blink}"
CONFIG_FILE="${MEA_CONFIG_FILE:-$CONFIG_DIR/mea_config}"
ANDROID_CONFIG="$ROOT/android/app/src/main/res/raw/mea_config"
IOS_CONFIG="$ROOT/ios/MeaConfig/mea_config"

log() {
  echo "[meawallet] $*"
}

vendored_version() {
  if [ -f "$VENDOR_DIR/package.json" ]; then
    sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$VENDOR_DIR/package.json" | head -n 1
  fi
}

install_config() {
  if [ ! -s "$CONFIG_FILE" ]; then
    log "no mea_config found, the SDK stays without configuration"
    return 0
  fi
  mkdir -p "$(dirname "$ANDROID_CONFIG")" "$(dirname "$IOS_CONFIG")"
  cp "$CONFIG_FILE" "$ANDROID_CONFIG"
  cp "$CONFIG_FILE" "$IOS_CONFIG"
  log "mea_config installed for Android and iOS"
}

install_package() {
  if [ "$(vendored_version)" = "$MPP_VERSION" ]; then
    log "@meawallet/react-native-mpp $MPP_VERSION already vendored"
    return 0
  fi

  if [ -z "${MEA_RN_USER:-}" ] && [ -f "$CONFIG_DIR/meawallet-rn.env" ]; then
    # shellcheck disable=SC1091
    . "$CONFIG_DIR/meawallet-rn.env"
  fi
  if [ -z "${MEA_RN_USER:-}" ] || [ -z "${MEA_RN_PASSWORD:-}" ]; then
    log "no MeaWallet credentials, skipping the push provisioning SDK"
    return 0
  fi

  work=$(mktemp -d)
  trap 'rm -rf "$work"' EXIT
  (
    umask 077
    printf 'machine nexus.ext.meawallet.com login %s password %s\n' \
      "$MEA_RN_USER" "$MEA_RN_PASSWORD" > "$work/netrc"
  )
  if ! curl -sSf --netrc-file "$work/netrc" -o "$work/package.tgz" "$MPP_TARBALL"; then
    log "could not download @meawallet/react-native-mpp $MPP_VERSION"
    return 1
  fi
  rm -f "$work/netrc"

  integrity=$(openssl dgst -sha512 -binary "$work/package.tgz" | openssl base64 -A)
  if [ "$integrity" != "$MPP_INTEGRITY" ]; then
    log "integrity mismatch for @meawallet/react-native-mpp $MPP_VERSION, not installing it"
    return 1
  fi

  tar -xzf "$work/package.tgz" -C "$work"
  rm -rf "$VENDOR_DIR"
  mkdir -p "$(dirname "$VENDOR_DIR")"
  mv "$work/package" "$VENDOR_DIR"
  log "@meawallet/react-native-mpp $MPP_VERSION vendored"
}

install_package
install_config
