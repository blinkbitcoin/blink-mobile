#!/bin/bash

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)

source ${REPO_ROOT}/dev/vendor/galoy-quickstart/bin/helpers.sh

ALICE_SUFFIX=$(cat /dev/urandom | tr -dc '0-9' | fold -w 6 | head -n 1)
ALICE_PHONE="+919836$ALICE_SUFFIX"

BOB_SUFFIX=$(cat /dev/urandom | tr -dc '0-9' | fold -w 6 | head -n 1)
BOB_PHONE="+919836$BOB_SUFFIX"

login_user "alice" "$ALICE_PHONE" "000000"
echo "alice logged in"
ALICE_TOKEN=$(read_value "alice")
receive_onchain
echo "alice funded"

login_user "alice" "$BOB_PHONE" "000000"
echo "bob logged in"
BOB_TOKEN=$(read_value "alice")
receive_onchain
echo "bob funded"

cat <<EOF > ${REPO_ROOT}/dev/.env.tmp.ci
ALICE_PHONE="$ALICE_PHONE"
ALICE_TOKEN="$ALICE_TOKEN"
ALICE_USERNAME="alice_$ALICE_SUFFIX"
BOB_PHONE="$BOB_PHONE"
BOB_TOKEN="$BOB_TOKEN"
BOB_USERNAME="bob_$BOB_SUFFIX"
EOF
