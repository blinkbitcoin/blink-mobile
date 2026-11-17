#!/bin/bash

set -eu

. pipeline-tasks/ci/tasks/helpers.sh

unpack_deps

pushd repo

use_ci_node_heap

yarn check-code
