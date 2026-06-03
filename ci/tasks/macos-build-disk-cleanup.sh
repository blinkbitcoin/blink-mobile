#!/bin/bash

set -euo pipefail

MODE="${1:-check}"
MIN_FREE_GB="${MIN_BUILD_FREE_GB:-${2:-30}}"
CI_ROOT="${CI_ROOT:-$(pwd)}"
DISK_CHECK_PATH="${DISK_CHECK_PATH:-$CI_ROOT}"
CONCOURSE_WORKDIR="${CONCOURSE_WORKDIR:-/Users/m1/concourse/workdir}"

required_kb=$((MIN_FREE_GB * 1024 * 1024))

free_kb() {
  df -Pk "$DISK_CHECK_PATH" | awk 'NR == 2 { print $4 }'
}

free_gb() {
  awk "BEGIN { printf \"%.1f\", $(free_kb) / 1024 / 1024 }"
}

remove_path() {
  local path="$1"

  if [[ -e "$path" || -L "$path" ]]; then
    echo "Removing $path"
    rm -rf -- "$path"
  fi
}

remove_old_children() {
  local dir="$1"
  local days="$2"

  if [[ -d "$dir" ]]; then
    echo "Removing children older than ${days}d from $dir"
    find "$dir" -mindepth 1 -maxdepth 1 -mtime +"$days" -exec rm -rf {} + || true
  fi
}

remove_all_children() {
  local dir="$1"

  if [[ -d "$dir" ]]; then
    echo "Removing children from $dir"
    find "$dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} + || true
  fi
}

current_ios_runtime_identifier() {
  local sdk_version
  sdk_version="$(xcodebuild -version -sdk iphoneos SDKVersion 2>/dev/null | tr -d '[:space:]' || true)"

  if [[ -n "$sdk_version" ]]; then
    echo "com.apple.CoreSimulator.SimRuntime.iOS-${sdk_version//./-}"
  fi
}

installed_ios_runtime_identifiers() {
  local runtime_list

  if ! command -v xcrun >/dev/null 2>&1; then
    echo "xcrun is not available on PATH." >&2
    return 1
  fi

  if ! runtime_list="$(xcrun simctl runtime list 2>&1)"; then
    echo "$runtime_list" >&2
    return 1
  fi

  printf "%s\n" "$runtime_list" \
    | sed -n 's/.*\(com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9A-Za-z.-]*\).*/\1/p' \
    | sort -u
}

print_disk_report() {
  echo "---- Disk usage ----"
  df -h "$DISK_CHECK_PATH" || true
  df -h || true

  echo "---- Large macOS build paths ----"
  for path in \
    "$CI_ROOT/repo/node_modules" \
    "$CI_ROOT/repo/ios/Pods" \
    "$CI_ROOT/repo/android/app/build" \
    "$CI_ROOT/repo/android/build" \
    "$CI_ROOT/repo/ios/build" \
    "$CONCOURSE_WORKDIR/volumes/dead" \
    "$CONCOURSE_WORKDIR/volumes/live" \
    "/private/var/root/Library/Developer/Xcode/Archives" \
    "/private/var/root/Library/Developer/Xcode/DerivedData" \
    "$HOME/Library/Developer/Xcode/Archives" \
    "$HOME/Library/Developer/Xcode/DerivedData" \
    "/Users/m1/Library/Developer/Xcode/Archives" \
    "/Users/m1/Library/Developer/Xcode/DerivedData" \
    "/Library/Developer/CoreSimulator/Volumes"; do
    if [[ -e "$path" ]]; then
      du -sh "$path" 2>/dev/null || true
    fi
  done

  echo "---- iOS simulator runtimes ----"
  if command -v xcrun >/dev/null 2>&1; then
    xcrun simctl runtime list || true
  fi
}

cleanup_workspace_build_outputs() {
  remove_path "$CI_ROOT/repo/android/app/build"
  remove_path "$CI_ROOT/repo/android/build"
  remove_path "$CI_ROOT/repo/ios/build"
  remove_path "$CI_ROOT/repo/ios/Blink.ipa"
}

cleanup_xcode_artifacts() {
  for dir in \
    "/private/var/root/Library/Developer/Xcode/Archives" \
    "$HOME/Library/Developer/Xcode/Archives" \
    "/Users/m1/Library/Developer/Xcode/Archives"; do
    remove_old_children "$dir" 28
  done

  for dir in \
    "/private/var/root/Library/Developer/Xcode/DerivedData" \
    "$HOME/Library/Developer/Xcode/DerivedData" \
    "/Users/m1/Library/Developer/Xcode/DerivedData"; do
    if [[ -d "$dir" ]]; then
      echo "Removing GaloyApp DerivedData older than 28d from $dir"
      find "$dir" -mindepth 1 -maxdepth 1 -name "GaloyApp-*" -mtime +28 -exec rm -rf {} + || true
    fi
  done
}

cleanup_concourse_dead_volumes() {
  remove_all_children "$CONCOURSE_WORKDIR/volumes/dead"
}

cleanup_old_ios_runtimes() {
  local current_runtime
  local installed_runtimes
  current_runtime="$(current_ios_runtime_identifier)"

  if [[ -z "$current_runtime" ]]; then
    echo "Could not determine current iOS SDK runtime; skipping simulator runtime cleanup."
    return
  fi

  echo "Keeping current iOS simulator runtime: $current_runtime"

  if ! installed_runtimes="$(installed_ios_runtime_identifiers)"; then
    echo "Could not list iOS simulator runtimes; skipping simulator runtime cleanup."
    return
  fi

  while IFS= read -r runtime; do
    [[ -z "$runtime" ]] && continue

    if [[ "$runtime" != "$current_runtime" ]]; then
      echo "Deleting old iOS simulator runtime: $runtime"
      xcrun simctl runtime delete "$runtime" || true
    fi
  done <<< "$installed_runtimes"
}

assert_current_ios_runtime_present() {
  local current_runtime
  local installed_runtimes
  current_runtime="$(current_ios_runtime_identifier)"

  if [[ -z "$current_runtime" ]]; then
    echo "Could not determine current iOS SDK runtime; skipping current runtime assertion."
    return
  fi

  if ! installed_runtimes="$(installed_ios_runtime_identifiers)"; then
    echo "ERROR: Could not list iOS simulator runtimes."
    echo "Check CoreSimulatorService/simdiskimaged on the Scaleway Mac before running the build."
    exit 1
  fi

  if ! printf "%s\n" "$installed_runtimes" | grep -qx "$current_runtime"; then
    echo "ERROR: Required iOS runtime $current_runtime is not installed."
    echo "Install the current platform runtime on the Scaleway Mac with: xcodebuild -downloadPlatform iOS"
    exit 1
  fi
}

assert_free_space() {
  local available
  available="$(free_kb)"

  if (( available < required_kb )); then
    echo "ERROR: Only $(free_gb) GB free on $DISK_CHECK_PATH after macOS build cleanup. Required: ${MIN_FREE_GB} GB."
    echo "Manual follow-up: remove only stale Concourse live volumes with the worker stopped, or run Nix garbage collection with the worker stopped."
    print_disk_report
    exit 1
  fi

  echo "Free disk space on $DISK_CHECK_PATH: $(free_gb) GB (required: ${MIN_FREE_GB} GB)"
}

case "$MODE" in
  check)
    print_disk_report
    assert_current_ios_runtime_present
    assert_free_space
    ;;
  pre|scheduled)
    print_disk_report
    cleanup_workspace_build_outputs
    cleanup_xcode_artifacts
    cleanup_concourse_dead_volumes
    assert_current_ios_runtime_present
    cleanup_old_ios_runtimes
    assert_current_ios_runtime_present
    assert_free_space
    ;;
  post)
    cleanup_workspace_build_outputs
    cleanup_concourse_dead_volumes
    print_disk_report
    ;;
  *)
    echo "Usage: $0 {check|pre|post|scheduled}" >&2
    exit 2
    ;;
esac
