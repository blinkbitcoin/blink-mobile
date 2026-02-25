#!/usr/bin/env python3
"""
Apply only the meaningful key-value changes from the PR branch onto main's JSON files,
preserving the original key order and formatting.
"""
import json
import subprocess
import sys
import os

def get_file_content(ref, path):
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        capture_output=True, text=True, cwd="/tmp/blink-mobile"
    )
    if result.returncode != 0:
        return None
    return result.stdout

def flatten_dict(d, prefix=""):
    items = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(flatten_dict(v, key))
        else:
            items[key] = v
    return items

def set_nested(d, dotkey, value):
    keys = dotkey.split(".")
    for k in keys[:-1]:
        d = d[k]
    d[keys[-1]] = value

def delete_nested(d, dotkey):
    keys = dotkey.split(".")
    for k in keys[:-1]:
        d = d[k]
    del d[keys[-1]]

def apply_changes(main_ref, pr_ref, filepath):
    main_content = get_file_content(main_ref, filepath)
    pr_content = get_file_content(pr_ref, filepath)
    if not main_content or not pr_content:
        print(f"  SKIP {filepath} (missing on one side)")
        return None

    main_data = json.loads(main_content)
    pr_data = json.loads(pr_content)

    main_flat = flatten_dict(main_data)
    pr_flat = flatten_dict(pr_data)

    changes = 0
    deletions = 0

    # Find changed values
    for key in pr_flat:
        if key in main_flat and main_flat[key] != pr_flat[key]:
            set_nested(main_data, key, pr_flat[key])
            changes += 1

    # Keys that are used in the codebase — do NOT delete
    keep_keys = {
        'ReceiveScreen.lightningAddress',
        'ReceiveScreen.lightningInvoice',
        'ReceiveScreen.bitcoinOnchain',
        'ReceiveScreen.depositFee',
        'AmountInputScreen.exceedsAvailableBalance',
    }

    # Find deleted keys (in main but not in PR)
    for key in main_flat:
        if key not in pr_flat and key not in keep_keys:
            try:
                delete_nested(main_data, key)
                deletions += 1
            except KeyError:
                pass

    # Find added keys (in PR but not in main) - unlikely but handle
    additions = 0
    for key in pr_flat:
        if key not in main_flat:
            # Need to add this key - set it in main_data
            keys = key.split(".")
            d = main_data
            for k in keys[:-1]:
                if k not in d:
                    d[k] = {}
                d = d[k]
            d[keys[-1]] = pr_flat[key]
            additions += 1

    if changes == 0 and deletions == 0 and additions == 0:
        print(f"  SKIP {filepath} (no changes)")
        return None

    print(f"  {filepath}: {changes} changed, {deletions} deleted, {additions} added")

    # Detect original indentation
    for line in main_content.split("\n")[1:5]:
        stripped = line.lstrip()
        if stripped:
            indent = len(line) - len(stripped)
            break
    else:
        indent = 4

    return json.dumps(main_data, indent=indent, ensure_ascii=False) + "\n"

def main():
    main_ref = "main"
    pr_ref = "fork/fix/rename-btc-usd-account-labels"

    # Process source en.json
    json_files = ["app/i18n/raw-i18n/source/en.json"]

    # Process all translation files
    result = subprocess.run(
        ["git", "show", f"{main_ref}:app/i18n/raw-i18n/translations/"],
        capture_output=True, text=True, cwd="/tmp/blink-mobile"
    )
    # List translation files from filesystem
    trans_dir = "/tmp/blink-mobile/app/i18n/raw-i18n/translations"
    for f in sorted(os.listdir(trans_dir)):
        if f.endswith(".json"):
            json_files.append(f"app/i18n/raw-i18n/translations/{f}")

    print(f"Processing {len(json_files)} JSON files...")

    for filepath in json_files:
        new_content = apply_changes(main_ref, pr_ref, filepath)
        if new_content:
            full_path = os.path.join("/tmp/blink-mobile", filepath)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(new_content)

    print("\nDone! JSON files updated with minimal changes.")

if __name__ == "__main__":
    main()
