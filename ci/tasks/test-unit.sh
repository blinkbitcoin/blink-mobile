#!/bin/bash

set -eu

. pipeline-tasks/ci/tasks/helpers.sh

unpack_deps

pushd repo

# Match GitHub Actions; on an 8 GiB worker Node's default heap cap is ~2 GB.
export NODE_OPTIONS=--max-old-space-size=4096

yarn test
