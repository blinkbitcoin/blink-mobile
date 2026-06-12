#!/bin/bash

set -euo pipefail

MODE="${1:-check}"
MIN_FREE_GB="${MIN_BUILD_FREE_GB:-${2:-30}}"
HARD_MIN_FREE_GB="${MIN_BUILD_HARD_FREE_GB:-10}"
ROOT_DERIVED_DATA_MAX_GB="${ROOT_DERIVED_DATA_MAX_GB:-20}"
CI_ROOT="${CI_ROOT:-$(pwd)}"
DISK_CHECK_PATH="${DISK_CHECK_PATH:-$CI_ROOT}"
CONCOURSE_WORKDIR="${CONCOURSE_WORKDIR:-/Users/m1/concourse/workdir}"
BUILD_HOME="${HOME:-/Users/m1}"

required_kb=$((MIN_FREE_GB * 1024 * 1024))
hard_required_kb=$((HARD_MIN_FREE_GB * 1024 * 1024))
root_derived_data_max_kb=$((ROOT_DERIVED_DATA_MAX_GB * 1024 * 1024))

free_kb() {
  df -Pk "$DISK_CHECK_PATH" | awk 'NR == 2 { print $4 }'
}

free_gb() {
  awk "BEGIN { printf \"%.1f\", $(free_kb) / 1024 / 1024 }"
}

free_space_below_target() {
  (( $(free_kb) < required_kb ))
}

path_size_kb() {
  local path="$1"

  if [[ -e "$path" ]]; then
    du -sk "$path" 2>/dev/null | awk 'NR == 1 { print $1 }'
  else
    echo 0
  fi
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

unique_paths() {
  printf "%s\n" "$@" | awk 'NF && !seen[$0]++'
}

current_ios_runtime_version() {
  xcodebuild -version -sdk iphoneos SDKVersion 2>/dev/null | tr -d '[:space:]' || true
}

installed_ios_runtimes() {
  local runtime_list
  local runtime_ids
  local disk_image_runtimes

  if ! command -v xcrun >/dev/null 2>&1; then
    echo "xcrun is not available on PATH." >&2
    return 1
  fi

  if ! runtime_list="$(xcrun simctl runtime list 2>&1)"; then
    echo "$runtime_list" >&2
    return 1
  fi

  runtime_ids="$(
    printf "%s\n" "$runtime_list" \
      | sed -n 's/.*\(com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9A-Za-z.-]*\).*/\1/p'
  )"

  while IFS= read -r runtime_id; do
    [[ -z "$runtime_id" ]] && continue

    local version="${runtime_id##*iOS-}"
    version="${version//-/.}"
    printf "%s\t%s\n" "$version" "$runtime_id"
  done <<< "$runtime_ids"

  disk_image_runtimes="$(
    printf "%s\n" "$runtime_list" \
      | sed -En 's/^[[:space:]]*iOS[[:space:]]+([0-9]+(\.[0-9]+)*)[[:space:]]+\([^)]+\)[[:space:]]+-[[:space:]]+([A-Fa-f0-9-]+).*/\1	\3/p'
  )"

  if [[ -n "$disk_image_runtimes" ]]; then
    printf "%s\n" "$disk_image_runtimes"
  fi
}

installed_ios_runtime_versions() {
  installed_ios_runtimes | cut -f1 | sort -u
}

installed_ios_runtime_delete_refs() {
  installed_ios_runtimes | sort -u
}

print_disk_report() {
  echo "---- Disk usage ----"
  df -h "$DISK_CHECK_PATH" || true
  df -h || true

  echo "---- Large macOS build paths ----"
  while IFS= read -r path; do
    if [[ -e "$path" ]]; then
      du -sh "$path" 2>/dev/null || true
    fi
  done < <(unique_paths \
    "$CI_ROOT/repo/node_modules" \
    "$CI_ROOT/repo/ios/Pods" \
    "$CI_ROOT/repo/android/app/build" \
    "$CI_ROOT/repo/android/build" \
    "$CI_ROOT/repo/ios/build" \
    "$CONCOURSE_WORKDIR/volumes/dead" \
    "$CONCOURSE_WORKDIR/volumes/live" \
    "/private/var/root/Library/Developer/Xcode/Archives" \
    "/private/var/root/Library/Developer/Xcode/DerivedData" \
    "$BUILD_HOME/Library/Developer/Xcode/Archives" \
    "$BUILD_HOME/Library/Developer/Xcode/DerivedData" \
    "/Users/m1/Library/Developer/Xcode/Archives" \
    "/Users/m1/Library/Developer/Xcode/DerivedData" \
    "/Library/Developer/CoreSimulator/Volumes")

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
  local root_derived_data="/private/var/root/Library/Developer/Xcode/DerivedData"
  local root_derived_data_size_kb

  while IFS= read -r dir; do
    remove_old_children "$dir" 28
  done < <(unique_paths \
    "/private/var/root/Library/Developer/Xcode/Archives" \
    "$BUILD_HOME/Library/Developer/Xcode/Archives" \
    "/Users/m1/Library/Developer/Xcode/Archives")

  while IFS= read -r dir; do
    if [[ -d "$dir" ]]; then
      echo "Removing GaloyApp DerivedData older than 28d from $dir"
      find "$dir" -mindepth 1 -maxdepth 1 -name "GaloyApp-*" -mtime +28 -exec rm -rf {} + || true
    fi
  done < <(unique_paths \
    "/private/var/root/Library/Developer/Xcode/DerivedData" \
    "$BUILD_HOME/Library/Developer/Xcode/DerivedData" \
    "/Users/m1/Library/Developer/Xcode/DerivedData")

  root_derived_data_size_kb="$(path_size_kb "$root_derived_data")"
  if free_space_below_target || (( root_derived_data_size_kb > root_derived_data_max_kb )); then
    echo "Removing root-owned Xcode DerivedData caches from $root_derived_data"
    echo "Reason: free disk $(free_gb) GB, root DerivedData $((root_derived_data_size_kb / 1024 / 1024)) GB, cap ${ROOT_DERIVED_DATA_MAX_GB} GB"
    remove_all_children "$root_derived_data"
  fi
}

cleanup_concourse_dead_volumes() {
  remove_all_children "$CONCOURSE_WORKDIR/volumes/dead"
}

cleanup_old_ios_runtimes() {
  local current_runtime_version
  local installed_runtimes
  current_runtime_version="$(current_ios_runtime_version)"

  if [[ -z "$current_runtime_version" ]]; then
    echo "Could not determine current iOS SDK runtime; skipping simulator runtime cleanup."
    return
  fi

  echo "Keeping current iOS simulator runtime version: $current_runtime_version"

  if ! installed_runtimes="$(installed_ios_runtime_delete_refs)"; then
    echo "Could not list iOS simulator runtimes; skipping simulator runtime cleanup."
    return
  fi

  while IFS=$'\t' read -r runtime_version runtime_delete_ref; do
    [[ -z "$runtime_version" || -z "$runtime_delete_ref" ]] && continue

    if [[ "$runtime_version" != "$current_runtime_version" ]]; then
      echo "Deleting old iOS simulator runtime $runtime_version: $runtime_delete_ref"
      xcrun simctl runtime delete "$runtime_delete_ref" || true
    fi
  done <<< "$installed_runtimes"
}

assert_current_ios_runtime_present() {
  local current_runtime_version
  local installed_runtime_versions
  current_runtime_version="$(current_ios_runtime_version)"

  if [[ -z "$current_runtime_version" ]]; then
    echo "Could not determine current iOS SDK runtime; skipping current runtime assertion."
    return
  fi

  if ! installed_runtime_versions="$(installed_ios_runtime_versions)"; then
    echo "ERROR: Could not list iOS simulator runtimes."
    echo "Check CoreSimulatorService/simdiskimaged on the Scaleway Mac before running the build."
    exit 1
  fi

  if ! printf "%s\n" "$installed_runtime_versions" | grep -qx "$current_runtime_version"; then
    echo "ERROR: Required iOS runtime $current_runtime_version is not installed."
    echo "Install the current platform runtime on the Scaleway Mac with: xcodebuild -downloadPlatform iOS"
    exit 1
  fi
}

assert_free_space() {
  local available
  available="$(free_kb)"

  if (( available <= hard_required_kb )); then
    echo "ERROR: Only $(free_gb) GB free on $DISK_CHECK_PATH after macOS build cleanup. Required: more than ${HARD_MIN_FREE_GB} GB."
    echo "Manual follow-up: remove only stale Concourse live volumes with the worker stopped, or run Nix garbage collection with the worker stopped."
    print_disk_report
    exit 1
  fi

  if (( available < required_kb )); then
    echo "WARNING: Only $(free_gb) GB free on $DISK_CHECK_PATH after macOS build cleanup. Target: ${MIN_FREE_GB} GB. Builds fail only at or below ${HARD_MIN_FREE_GB} GB."
    echo "Manual follow-up: remove only stale Concourse live volumes with the worker stopped, or run Nix garbage collection with the worker stopped."
    print_disk_report
    return
  fi

  echo "Free disk space on $DISK_CHECK_PATH: $(free_gb) GB (target: ${MIN_FREE_GB} GB, hard minimum: more than ${HARD_MIN_FREE_GB} GB)"
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
