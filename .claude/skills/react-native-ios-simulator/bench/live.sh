#!/bin/bash
# Live capture/recording benchmark - the numbers that decide which
# optimization is worth building. Report-only: no assertions (machine
# variance), one JSON artifact per run plus a printed summary.
#
# Requires a claimed session (eval claim-session.sh first) and only ever
# touches that session's simulator - every isolation rule of the skill
# applies unchanged. The measurement loops run inside ONE python3 process
# using time.monotonic() around subprocess calls, so the interpreter cost is
# paid once, outside every measured interval - bash-timing each shot would
# add two ~30ms spawns per sample and distort the distribution it measures.
#
# What it measures and why:
#   shot latency distribution (xN)   the settle-sleep policy depends on the
#                                    p50/p95 of ONE shot, not a mean
#   xcrun dispatch vs direct simctl  if `xcrun` resolution costs 50-150ms per
#                                    shot, caching $(xcrun -f simctl) is free
#   png vs jpeg screenshot           encode time is part of shot latency
#   shasum vs cmp frame compare      is the settle loop's hash cost real?
#   capture settle at gap 0/0.3/0.6  does the sleep dominate, or the shot?
#   recorder start/stop latency      how much of every recording is overhead
#   encode throughput per codec      libx264 vs h264_videotoolbox, VP9
#                                    cpu-used, single- vs double-decode GIF
#
# Not measured here: Metro first-bundle (needs an app worktree; measured in
# real sessions by hand) and Maestro warmup decomposition (needs the app
# installed and a driver state to compare; run a virgin-vs-warm pair manually
# when gating the warmup-skip optimization).
#
# Usage: bench/live.sh [--shots N] [--skip-record] [--smoke] [--out FILE]
#   --shots        samples per latency distribution (default 15)
#   --skip-record  skip the recorder+encode sections (no clip written)
#   --smoke        fake-backed schema check for the test suite: shot section
#                  only, n=2, no direct-simctl probing
#   --out          JSON path (default: <telemetry dir>/bench-<stamp>.json)

set -euo pipefail

die() { echo "FATAL: $*" >&2; exit 1; }

SHOTS=15; SKIP_RECORD=""; SMOKE=""; OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --shots)       SHOTS="${2:?--shots needs a number}"; shift 2 ;;
    --skip-record) SKIP_RECORD=1; shift ;;
    --smoke)       SMOKE=1; SKIP_RECORD=1; SHOTS=2; shift ;;
    --out)         OUT="${2:?--out needs a path}"; shift 2 ;;
    *) die "unknown argument '$1'" ;;
  esac
done

# The bench only ever touches a simulator this agent claimed - benchmarking
# whatever device happens to be booted would hammer the user's simulator with
# screenshot and recording load.
[ -n "${DEMO_UDID:-}" ] || die "no claimed session: eval claim-session.sh first (the bench must never touch a device you did not claim)"

TEL_DIR="${DEMO_TELEMETRY_DIR:-${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}/telemetry}"
mkdir -p "$TEL_DIR"
[ -n "$OUT" ] || OUT="$TEL_DIR/bench-$(date +%Y%m%d-%H%M%S).json"

CAPTURE="$(dirname "${BASH_SOURCE[0]}")/../../react-native-demo-screenshots/scripts/capture.sh"

BENCH_UDID="$DEMO_UDID" BENCH_SHOTS="$SHOTS" BENCH_SMOKE="${SMOKE:-0}" \
BENCH_SKIP_RECORD="${SKIP_RECORD:-0}" BENCH_OUT="$OUT" BENCH_CAPTURE="$CAPTURE" \
python3 <<'PY'
import json
import os
import shutil
import signal
import statistics
import subprocess
import sys
import tempfile
import time

UDID = os.environ["BENCH_UDID"]
SHOTS = int(os.environ["BENCH_SHOTS"])
SMOKE = os.environ["BENCH_SMOKE"] == "1"
SKIP_RECORD = os.environ["BENCH_SKIP_RECORD"] == "1"
OUT = os.environ["BENCH_OUT"]
CAPTURE = os.environ["BENCH_CAPTURE"]

tmp = tempfile.mkdtemp(prefix="live-bench.")
report = {"v": 1, "udid": UDID, "smoke": SMOKE,
          "context": {}, "shot_latency": {}, "compare_cost": None,
          "settle_capture": {}, "recorder": None, "encode": None}


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def timed(cmd, n, ok_codes=(0,)):
    """n timed invocations -> list of seconds; None on first failure.
    ok_codes: cmp -s legitimately exits 1 on differing files - still a sample."""
    out = []
    for _ in range(n):
        t0 = time.monotonic()
        r = run(cmd)
        dt = time.monotonic() - t0
        if r.returncode not in ok_codes:
            return None
        out.append(round(dt, 4))
    return out


def dist(samples):
    if not samples:
        return None
    s = sorted(samples)
    return {"n": len(s), "p50": s[len(s) // 2], "p95": s[max(0, -(-len(s) * 95 // 100) - 1)],
            "min": s[0], "max": s[-1], "mean": round(sum(s) / len(s), 4)}


def sysctl(name):
    r = run(["sysctl", "-n", name])
    return r.stdout.strip() if r.returncode == 0 else ""


# --- context: numbers without context cannot be compared across runs ---------
report["context"] = {
    "date": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "model": sysctl("hw.model"),
    "cpu": sysctl("machdep.cpu.brand_string"),
    "loadavg": os.getloadavg(),
    "maestro": (run(["maestro", "--version"]).stdout.strip() if shutil.which("maestro") else ""),
    "ffmpeg": (run(["ffmpeg", "-version"]).stdout.splitlines()[0] if shutil.which("ffmpeg") else ""),
}
if not SMOKE:
    r = run(["xcrun", "simctl", "list", "devices", "-j"])
    try:
        for rt, devs in json.loads(r.stdout)["devices"].items():
            if any(d["udid"] == UDID for d in devs):
                report["context"]["runtime"] = rt
    except Exception:
        pass

# --- shot latency distributions ----------------------------------------------
shot = os.path.join(tmp, "s.png")
report["shot_latency"]["png_xcrun"] = dist(timed(["xcrun", "simctl", "io", UDID, "screenshot", shot], SHOTS))

if not SMOKE:
    r = run(["xcrun", "-f", "simctl"])
    simctl = r.stdout.strip() if r.returncode == 0 else ""
    if simctl:
        report["shot_latency"]["png_direct"] = dist(timed([simctl, "io", UDID, "screenshot", shot], SHOTS))
        jpg = os.path.join(tmp, "s.jpeg")
        report["shot_latency"]["jpeg_direct"] = dist(timed([simctl, "io", UDID, "screenshot", "--type=jpeg", jpg], SHOTS))

    # --- frame-compare cost: is the settle loop's shasum worth optimizing? ---
    shot2 = os.path.join(tmp, "s2.png")
    run(["xcrun", "simctl", "io", UDID, "screenshot", shot2])
    if os.path.exists(shot) and os.path.exists(shot2):
        report["compare_cost"] = {
            "shasum": dist(timed(["shasum", "-a", "256", shot], 20)),
            "cmp": dist(timed(["cmp", "-s", shot, shot2], 20, ok_codes=(0, 1))),
        }

    # --- capture.sh settle convergence at different gaps ---------------------
    for gap in ("0.6", "0.3", "0"):
        env = dict(os.environ, SHOT_SETTLE=gap, DEMO_UDID=UDID)
        t0 = time.monotonic()
        r = subprocess.run([CAPTURE, "bench-settle", tmp], env=env,
                           capture_output=True, text=True)
        report["settle_capture"]["gap_" + gap] = (
            round(time.monotonic() - t0, 3) if r.returncode == 0 else None)

# --- recorder start/stop latency + a clip for the encode section -------------
if not SKIP_RECORD:
    clip = os.path.join(tmp, "clip.mov")
    t0 = time.monotonic()
    rec = subprocess.Popen(
        ["xcrun", "simctl", "io", UDID, "recordVideo", "--codec", "h264", clip],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        preexec_fn=lambda: signal.signal(signal.SIGINT, signal.SIG_DFL))
    start_wait = None
    while time.monotonic() - t0 < 3.0:
        if os.path.exists(clip) and os.path.getsize(clip) > 0:
            start_wait = round(time.monotonic() - t0, 3)
            break
        if rec.poll() is not None:
            break
        time.sleep(0.05)
    time.sleep(4)   # a few seconds of material for the encode section
    t1 = time.monotonic()
    rec.send_signal(signal.SIGINT)
    try:
        rec.wait(timeout=15)
        finalize = round(time.monotonic() - t1, 3)
    except subprocess.TimeoutExpired:
        rec.kill()
        finalize = None
    report["recorder"] = {
        "start_wait_s": start_wait,          # None on new runtimes that buffer in memory
        "finalize_s": finalize,
        "clip_bytes": os.path.getsize(clip) if os.path.exists(clip) else 0,
    }

    # --- encode throughput per codec ----------------------------------------
    if report["recorder"]["clip_bytes"] > 0 and shutil.which("ffmpeg"):
        encoders = run(["ffmpeg", "-hide_banner", "-encoders"]).stdout
        vf = "fps=24,scale=480:-2:flags=lanczos"
        enc = {}

        def encode(name, args, outfile):
            t0 = time.monotonic()
            r = run(["ffmpeg", "-y", "-v", "error", "-i", clip] + args + [outfile])
            enc[name] = (round(time.monotonic() - t0, 3) if r.returncode == 0
                         and os.path.getsize(outfile) > 0 else None)

        encode("mp4_libx264", ["-vf", vf, "-c:v", "libx264", "-profile:v", "baseline",
                               "-pix_fmt", "yuv420p", "-crf", "28", "-an"], os.path.join(tmp, "o1.mp4"))
        if "h264_videotoolbox" in encoders:
            encode("mp4_videotoolbox", ["-vf", vf, "-c:v", "h264_videotoolbox", "-q:v", "50",
                                        "-pix_fmt", "yuv420p", "-an"], os.path.join(tmp, "o2.mp4"))
        encode("webm_vp9_default", ["-vf", vf, "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
                                    "-row-mt", "1", "-pix_fmt", "yuv420p", "-an"], os.path.join(tmp, "o3.webm"))
        encode("webm_vp9_cpu4", ["-vf", vf, "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
                                 "-row-mt", "1", "-cpu-used", "4", "-pix_fmt", "yuv420p", "-an"],
               os.path.join(tmp, "o4.webm"))
        # Current GIF pipeline decodes the full-res input twice...
        t0 = time.monotonic()
        pal = os.path.join(tmp, "pal.png")
        gvf = "fps=12,scale=480:-1:flags=lanczos"
        ok1 = run(["ffmpeg", "-y", "-v", "error", "-i", clip, "-vf", gvf + ",palettegen=stats_mode=diff", pal]).returncode == 0
        ok2 = ok1 and run(["ffmpeg", "-y", "-v", "error", "-i", clip, "-i", pal, "-lavfi",
                           gvf + ",paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
                           os.path.join(tmp, "o5.gif")]).returncode == 0
        enc["gif_double_decode"] = round(time.monotonic() - t0, 3) if ok2 else None
        # ...vs pre-scaling once and paletting the small intermediate.
        t0 = time.monotonic()
        small = os.path.join(tmp, "small.mov")
        ok1 = run(["ffmpeg", "-y", "-v", "error", "-i", clip, "-vf", gvf, "-c:v", "libx264",
                   "-crf", "18", "-an", small]).returncode == 0
        ok2 = ok1 and run(["ffmpeg", "-y", "-v", "error", "-i", small, "-vf", "palettegen=stats_mode=diff", pal]).returncode == 0
        ok3 = ok2 and run(["ffmpeg", "-y", "-v", "error", "-i", small, "-i", pal, "-lavfi",
                           "paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
                           os.path.join(tmp, "o6.gif")]).returncode == 0
        enc["gif_single_decode"] = round(time.monotonic() - t0, 3) if ok3 else None
        report["encode"] = enc

with open(OUT, "w") as f:
    json.dump(report, f, indent=2)

print("live bench -> %s" % OUT)
sl = report["shot_latency"].get("png_xcrun")
if sl:
    print("shot latency (xcrun, png): p50 %.2fs  p95 %.2fs  n=%d" % (sl["p50"], sl["p95"], sl["n"]))
for k in ("png_direct", "jpeg_direct"):
    d = report["shot_latency"].get(k)
    if d:
        print("shot latency (%s):%s p50 %.2fs" % (k, " " * max(1, 12 - len(k)), d["p50"]))
cc = report["compare_cost"] or {}
if cc.get("shasum") and cc.get("cmp"):
    print("frame compare: shasum p50 %.3fs vs cmp p50 %.3fs" %
          (cc["shasum"]["p50"], cc["cmp"]["p50"]))
for gap, dur in sorted(report["settle_capture"].items()):
    print("capture settle %s: %s" % (gap, ("%.2fs" % dur) if dur else "failed"))
if report["recorder"]:
    print("recorder: start_wait=%s finalize=%s" %
          (report["recorder"]["start_wait_s"], report["recorder"]["finalize_s"]))
if report["encode"]:
    for name, dur in sorted(report["encode"].items(), key=lambda kv: kv[1] or 9e9):
        print("encode %-20s %s" % (name, ("%.2fs" % dur) if dur else "unavailable"))

shutil.rmtree(tmp, ignore_errors=True)
PY
