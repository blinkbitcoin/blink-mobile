#!/usr/bin/env python3
"""Merge translated keys into a language JSON file, sorted to match English key order."""
import json, sys, os

def flatten(d, prefix=""):
    items = []
    for k, v in d.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(flatten(v, full))
        else:
            items.append((full, v))
    return items

def unflatten(items):
    result = {}
    for key, value in items:
        parts = key.split(".")
        d = result
        for part in parts[:-1]:
            d = d.setdefault(part, {})
        d[parts[-1]] = value
    return result

def main():
    if len(sys.argv) < 4:
        print("Usage: merge-translations.py <existing.json> <translated.json> <output.json> [en-keys.json]")
        sys.exit(1)
    
    existing_path, translated_path, output_path = sys.argv[1], sys.argv[2], sys.argv[3]
    en_keys_path = sys.argv[4] if len(sys.argv) > 4 else None
    
    with open(existing_path) as f:
        existing = json.load(f)
    with open(translated_path) as f:
        translated = json.load(f)
    
    # Flatten both
    existing_flat = dict(flatten(existing))
    translated_flat = dict(flatten(translated) if isinstance(next(iter(translated.values()), {}), dict) else translated.items())
    
    # Merge: translated overwrites existing
    merged = {**existing_flat, **translated_flat}
    
    # Sort to match English key order if provided
    if en_keys_path:
        with open(en_keys_path) as f:
            en_order = json.load(f)
        ordered = []
        en_set = set(en_order)
        for k in en_order:
            if k in merged:
                ordered.append((k, merged[k]))
        # Add any keys not in English (shouldn't happen but safety)
        for k, v in merged.items():
            if k not in en_set:
                ordered.append((k, v))
    else:
        ordered = sorted(merged.items())
    
    result = unflatten(ordered)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")
    
    print(f"Merged {len(translated_flat)} keys into {output_path} ({len(merged)} total)")

if __name__ == "__main__":
    main()
