#!/bin/bash

export CI_ROOT=$(pwd)

if [[ -z $(git config --global user.email) ]]; then
  git config --global user.email "bot@galoy.io" > /dev/null
fi
if [[ -z $(git config --global user.name) ]]; then
  git config --global user.name "CI Bot" > /dev/null
fi

function unpack_deps() {

  echo "Unpacking deps... "

  pushd ${REPO_PATH:-repo} > /dev/null

  tar -zxvf ../bundled-deps/bundled-deps-*.tgz ./node_modules/ ./yarn.lock > /dev/null

  if [[ "$(git status -s -uno)" != "" ]]; then
    echo "Extracting deps has created a diff - deps are not in sync"
    git --no-pager diff
    exit 1;
  fi

  echo "Done!"

  popd
}

# Echos Closes Text for all existing PRs which this PR supersedes
# Usage: get_closes (beta|public) (version-number)
function get_closes() {
  gh pr list --state open --json url,headRefName --label $1 --label "blinkbitcoinbot" --limit 100 | jq -c '.[]' | while read item; do
  gh_pr_branch_version=$(echo $item | jq -r '.headRefName' | cut -d "-" -f2)
  if [[ $(semver-compare $gh_pr_branch_version $2) == "-1" ]]; then
    gh_pr_url=$(echo $item | jq -r '.url')
    echo "Closes $gh_pr_url"
  fi
done
}

function get_changelog_from_merged_pr() {
  gh pr list --state merged --json body,number,headRefName --label $1 --label "blinkbitcoinbot" | jq -c 'sort_by(.number) | reverse | .[]' | while IFS="" read -r item || [ -n "$item" ]; do
    gh_pr_branch_version=$(echo -E $item | jq -r '.headRefName' | cut -d "-" -f2)

    if [[ $(semver-compare $gh_pr_branch_version $2) == "0" ]]; then
      TMPDIR=$(mktemp -d -t get_changelog_from_merged_pr.XXXXXX)
      echo -E $item | jq -r '.body' > ${TMPDIR}/pr-body

      changelog_line_begin=$(( $(cat ${TMPDIR}/pr-body | awk '/^### ChangeLog:/{ print NR; exit }') + 2 ))
      changelog_line_end=$(( $(cat ${TMPDIR}/pr-body | wc -l) - $(cat ${TMPDIR}/pr-body | tac | awk '/^### Release Notes/{ print NR; exit }') - 2 ))

      sed -n ${changelog_line_begin},${changelog_line_end}p ${TMPDIR}/pr-body
      rm -rf ${TMPDIR}
      break
    fi
  done
}

function echo_custom_release_notes_defaults() {
  echo "<!-- Remove this line and type custom release notes here -->"
  echo "<!-- This will be added to GitHub Release & Store Release Changelog -->"
}

function __get_custom_release_notes() {
  gh pr list --state $3 --json body,number,headRefName --label $1 --label "blinkbitcoinbot" | jq -c 'sort_by(.number) | reverse | .[]' | while IFS="" read -r item || [ -n "$item" ]; do
    gh_pr_branch_version=$(echo -E $item | jq -r '.headRefName' | cut -d "-" -f2)

    if [[ $(semver-compare $gh_pr_branch_version $2) == "0" ]]; then
      TMPDIR=$(mktemp -d -t get_custom_release_notes.XXXXXX)
      echo -E $item | jq -r '.body' > ${TMPDIR}/pr-body

      custom_release_notes_line_begin=$(( $(cat ${TMPDIR}/pr-body | awk '/^### Release Notes:/{ print NR; exit }') + 2 ))
      custom_release_notes_line_end=$(( $(cat ${TMPDIR}/pr-body | wc -l) - $(cat ${TMPDIR}/pr-body | tac | awk '/^```/{ print NR; exit }') ))

      sed -n ${custom_release_notes_line_begin},${custom_release_notes_line_end}p ${TMPDIR}/pr-body > ${TMPDIR}/custom-release-notes-as-is

      while IFS="" read -r p || [ -n "$p" ]
      do
        if [[ ! "$p" == \<\!\-\-* ]]; then
          printf '%s\n' "$p"
        fi
      done < ${TMPDIR}/custom-release-notes-as-is

      rm -rf ${TMPDIR}
      break
    fi
  done
}

# Fetch Custom Release Notes from the latest PR
# Usage: get_custom_release_notes (beta|public) (version-number) (state:open|merged|closed)
function get_custom_release_notes() {
  NOTES=$(__get_custom_release_notes $1 $2 $3)
  if [[ $NOTES == "" ]]; then
    echo_custom_release_notes_defaults
  else
    echo $NOTES
  fi
}

# Fetch Older Ref from the latest merged PR
# Usage: get_custom_release_notes (beta|public) (version-number)
function get_old_ref_from_merged() {
  gh pr list --state merged --label $1 --label "blinkbitcoinbot" --json body,number,headRefName | jq -c 'sort_by(.number) | reverse | .[]' | while IFS="" read -r item || [ -n "$item" ]; do
    gh_pr_branch_version=$(echo -E $item | jq -r '.headRefName' | cut -d "-" -f2)

    if [[ $(semver-compare $gh_pr_branch_version $2) == "0" ]]; then
      COMPARE_LINE=$(echo -E $item | jq -r '.body' | grep "Code Diff: https://github.com/GaloyMoney/galoy-mobile/compare")
      [[ "$COMPARE_LINE" =~ galoy-mobile/compare/(.*)\.\.\..* ]]
      echo ${BASH_REMATCH[1]}
      break
    fi
  done
}

function activate_gcloud_service_account() {
  echo ${ARTIFACTS_BUCKET_SA_JSON_KEY} > ${CI_ROOT}/gcloud-creds.json
  gcloud auth activate-service-account --key-file ${CI_ROOT}/gcloud-creds.json
  rm ${CI_ROOT}/gcloud-creds.json
}

# Must be called from root of this repository
function download_build_apk() {
  mkdir -p android/app/build/outputs/apk
  pushd android/app/build/outputs/apk
  gsutil cp -r ${URL%\/*} .
  popd
}

# Must be called from root of this repository
function download_build_ipa() {
  pushd ios
  gsutil cp -r ${URL%\/*}/* .
  popd
}
