#!/bin/sh

# Runs one command, a `yarn install`, with read access to the @blinkbitcoin scope on
# GitHub Packages, which wants a token even for a public package.
#
# Usage: with-github-packages-auth.sh <npmrc> <command> [args...]
#
# The token goes in <npmrc>, a file of the build's own outside any checkout (install-deps
# tars its checkout into the deps bundle), never in ~/.npmrc of a worker that outlives the
# build. Only the command reads it, in place of ~/.npmrc, whose settings are carried over,
# and it is removed as soon as the command is done. POSIX sh, so the bash tasks and
# build.sh, which runs under zsh, share this one copy.

set -eu

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <npmrc> <command> [args...]" >&2
  exit 2
fi

npmrc="$1"
shift

if [ -z "${GITHUB_PACKAGES_TOKEN:-}" ]; then
  exec "$@"
fi

trap 'rm -f "$npmrc"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

(
  umask 077
  {
    if [ -f "${HOME}/.npmrc" ]; then
      cat "${HOME}/.npmrc"
    fi
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}"
  } > "$npmrc"
)

NPM_CONFIG_USERCONFIG="$npmrc" "$@"
