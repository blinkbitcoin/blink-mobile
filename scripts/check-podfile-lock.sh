#!/bin/sh

# Fails when the ios/Podfile.lock staged for commit carries the MeaWallet pods. On a
# machine with MeaWallet access, pod install adds BlinkMeaConfig and the vendored SDK's
# pod to the lock, and CocoaPods has no per-machine lock, so the guard is on what gets
# committed: once committed, those lines reach every contributor, whose next pod install
# strips them again. The index is read rather than the working copy, so a lock that pod
# install changed passes until those lines are staged. See docs/dev.md.

set -eu

cd "$(dirname "$0")/.."

if git show :ios/Podfile.lock | grep -q -E "BlinkMeaConfig|react-native-mpp"; then
  echo "ios/Podfile.lock carries the MeaWallet pods, which each machine installs on its own."
  echo "Commit the lock without those lines, see docs/dev.md."
  exit 1
fi
