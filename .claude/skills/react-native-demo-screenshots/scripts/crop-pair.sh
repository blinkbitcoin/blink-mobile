#!/bin/bash
# Crop a before/after pair using one identical box.
#
# Cropping the two sides differently is the quiet way to make a comparison lie:
# a tighter crop on "after" makes it look cleaner for reasons that have nothing
# to do with the change. This applies one box to both and refuses to run when
# the inputs are not the same size to begin with.
#
# Usage: crop-pair.sh <before.png> <after.png> --crop WxH+X+Y [--out-dir D]
#
#   crop-pair.sh shots/before.png shots/after.png --crop 1179x600+0+400

set -uo pipefail

BEFORE=""; AFTER=""; CROP=""; OUTDIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --crop)    CROP="${2:?--crop needs WxH+X+Y}"; shift 2 ;;
    --out-dir) OUTDIR="${2:?}"; shift 2 ;;
    -*) echo "FATAL: unknown option '$1'" >&2; exit 64 ;;
    *) if [ -z "$BEFORE" ]; then BEFORE="$1"; else AFTER="$1"; fi; shift ;;
  esac
done

die() { echo "FATAL: $*" >&2; exit 1; }

[ -n "$BEFORE" ] && [ -n "$AFTER" ] || die "usage: crop-pair.sh <before.png> <after.png> --crop WxH+X+Y"
[ -f "$BEFORE" ] || die "not found: $BEFORE"
[ -f "$AFTER" ]  || die "not found: $AFTER"
[ -n "$CROP" ]   || die "--crop is required (WxH+X+Y)"
command -v magick >/dev/null 2>&1 || die "ImageMagick (magick) is not installed"

case "$CROP" in
  *x*+*+*) : ;;
  *) die "--crop must look like WxH+X+Y, got '$CROP'" ;;
esac

dims() { magick identify -format "%wx%h" "$1" 2>/dev/null; }

DB=$(dims "$BEFORE"); DA=$(dims "$AFTER")
[ -n "$DB" ] || die "$BEFORE is not a readable image"
[ -n "$DA" ] || die "$AFTER is not a readable image"
[ "$DB" = "$DA" ] || die "inputs differ in size ($BEFORE is $DB, $AFTER is $DA).
       A pair shot on different devices or orientations cannot share a crop box;
       re-shoot both on the same simulator."

# The box must actually fit, or magick silently returns a smaller image and the
# two sides stop being comparable.
CW=${CROP%%x*}; REST=${CROP#*x}; CH=${REST%%+*}
OFF=${CROP#*+}; CX=${OFF%%+*}; CY=${OFF##*+}
IW=${DB%%x*}; IH=${DB##*x}
[ $((CX + CW)) -le "$IW" ] && [ $((CY + CH)) -le "$IH" ] \
  || die "crop box $CROP does not fit inside ${IW}x${IH}"

for f in "$BEFORE" "$AFTER"; do
  base=$(basename "$f")
  if [ -n "$OUTDIR" ]; then mkdir -p "$OUTDIR"; out="$OUTDIR/$base"; else out="$f"; fi
  magick "$f" -crop "$CROP" +repage "$out" || die "crop failed for $f"
done

echo "cropped both sides to $CROP (from $DB)"
