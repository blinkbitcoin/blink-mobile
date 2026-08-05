#!/bin/bash
# Encode a simulator recording for publishing, as either MP4 or GIF.
#
# `simctl recordVideo` emits a large, variable-frame-rate, device-resolution
# QuickTime file. Neither route accepts that as-is: the explicit fps filter is
# what stops GIF timing from drifting, and the downscale is what keeps either
# format under GitHub's attachment ceiling.
#
# Usage: encode-demo.sh <in> <out> --format gif|mp4|webm [--width N] [--fps N] [--max-mb N]
#   <in> is whatever the recorder produced: .mov (simctl) or .mp4 (screenrecord).
#   webm (VP9) runs ~30% smaller than mp4 at the same quality — use it when a
#   longer walkthrough busts the size budget. Like mp4 it only plays via the
#   Chrome upload route, never from the assets branch.

set -uo pipefail

IN=""; OUT=""; FORMAT=""; WIDTH=480; FPS=""; MAX_MB=10

while [ $# -gt 0 ]; do
  case "$1" in
    --format)  FORMAT="${2:?--format needs gif or mp4}"; shift 2 ;;
    --width)   WIDTH="${2:?}";  shift 2 ;;
    --fps)     FPS="${2:?}";    shift 2 ;;
    --max-mb)  MAX_MB="${2:?}"; shift 2 ;;
    -*) echo "FATAL: unknown option '$1'" >&2; exit 64 ;;
    *) if [ -z "$IN" ]; then IN="$1"; else OUT="$1"; fi; shift ;;
  esac
done

die() { echo "FATAL: $*" >&2; exit 1; }

[ -n "$IN" ]  || die "usage: encode-demo.sh <in.mov> <out> --format gif|mp4"
[ -n "$OUT" ] || die "no output file given"
[ -f "$IN" ]  || die "input not found: $IN"
command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg is not installed"

case "$FORMAT" in
  gif)      : "${FPS:=12}" ;;
  mp4|webm) : "${FPS:=24}" ;;
  "")  die "--format is required (gif, mp4 or webm)" ;;
  *)   die "--format must be 'gif', 'mp4' or 'webm', got '$FORMAT'" ;;
esac

case "$WIDTH" in ''|*[!0-9]*) die "--width must be numeric, got '$WIDTH'" ;; esac
case "$FPS"   in ''|*[!0-9]*) die "--fps must be numeric, got '$FPS'" ;; esac

TMP="$(mktemp -d "${TMPDIR:-/tmp}/encode-demo.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

if [ "$FORMAT" = "webm" ]; then
  # VP9 at constant quality: -b:v 0 hands rate control entirely to -crf.
  # crf 34 for VP9 sits at roughly the quality of x264 crf 28 at ~30% less
  # size. row-mt spreads the (slow) VP9 encode across cores. -an as with mp4:
  # neither recorder captures audio.
  ffmpeg -y -v error -i "$IN" \
    -vf "fps=$FPS,scale=$WIDTH:-2:flags=lanczos" \
    -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -pix_fmt yuv420p -an \
    "$OUT" || die "ffmpeg failed to write $OUT (libvpx-vp9 missing from this ffmpeg?)"
elif [ "$FORMAT" = "mp4" ]; then
  # yuv420p because Safari and GitHub's player reject other pixel formats.
  # faststart moves the index to the front so playback can begin before the
  # whole file has arrived. -an: simctl captures no audio, so drop the track
  # rather than shipping a silent one.
  # scale=-2 keeps height even, which libx264 requires.
  ffmpeg -y -v error -i "$IN" \
    -vf "fps=$FPS,scale=$WIDTH:-2:flags=lanczos" \
    -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p \
    -crf 28 -movflags +faststart -an \
    "$OUT" || die "ffmpeg failed to write $OUT"
else
  # Two passes. A single pass builds its palette from the opening frames, so
  # anything that appears later (a modal, a different screen) bands badly.
  # stats_mode=diff weights the palette toward the pixels that actually move.
  ffmpeg -y -v error -i "$IN" \
    -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff" \
    "$TMP/palette.png" || die "ffmpeg failed to build a palette"

  [ -s "$TMP/palette.png" ] || die "palette pass produced nothing"

  ffmpeg -y -v error -i "$IN" -i "$TMP/palette.png" \
    -lavfi "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    -loop 0 \
    "$OUT" || die "ffmpeg failed to write $OUT"
fi

[ -s "$OUT" ] || die "no output was written to $OUT"

# --- Size budget ------------------------------------------------------------
# Reported, never silently exceeded: an oversized file fails at publish time,
# which is far more expensive than knowing here.
BYTES=$(wc -c < "$OUT" | tr -d ' ')
MB=$(python3 -c "print('%.1f' % ($BYTES/1048576.0))")
echo "$FORMAT ${MB}MB (${WIDTH}px, ${FPS}fps) -> $OUT"

OVER=$(python3 -c "print(1 if $BYTES > $MAX_MB*1048576 else 0)")
if [ "$OVER" = "1" ]; then
  echo "WARNING: ${MB}MB exceeds the ${MAX_MB}MB budget." >&2
  echo "         Shorten the flow, or retry with --width $((WIDTH * 3 / 4))" >&2
  [ "$FORMAT" = "gif" ] && echo "         or --fps $((FPS > 8 ? FPS - 4 : FPS))" >&2
  exit 3
fi
