import * as React from "react"
import { View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { Button, makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  BusyStateScreen,
  CHIP_GLYPH_SIZE,
  SIGNAL_MS,
  type BusyStateError,
} from "@app/components/busy-state"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"

/**
 * A throwaway harness for the universal busy state, reachable from the developer
 * screen. It is wired to nothing: no query, no navigation, no real work — the
 * point is to judge the motion and the copy on a device before any production
 * screen adopts the component.
 *
 * It also flips the route's header and swipe-back off while a run is showing,
 * which a production route does once in its screen options.
 *
 * The glyphs here are stand-ins. `galoy-icon` has no Nostr/ostrich entry yet, so
 * the second chip borrows `share` (a network glyph). Whatever screen adopts this
 * first brings its own icons.
 */

const SHORT_TITLE = "Your backup phrase is used to create your Nostr keys"
const SHORT_BODY = "Generating keys…"

const LONG_TITLE =
  "Deine Wiederherstellungsphrase wird verwendet, um deine Nostr-Schlüssel zu erzeugen und zu sichern"
const LONG_BODY = "Schlüssel werden erzeugt und im Gerätespeicher abgelegt…"

const ERROR_TITLE = "Something went wrong"
const ERROR_BODY =
  "We couldn't create your Nostr keys. Check your connection and try again."

/** Which error buttons a failing run offers. */
type ErrorButtons = "retry-back" | "back" | "retry-back-close"

/** How long the fake async job takes in `pending` mode. */
const FAKE_WORK_MS = 6000
/** A job that finishes faster than the entrance, to prove the floor holds. */
const FAKE_INSTANT_WORK_MS = 80
/** How long a failing job runs before it reports the error. */
const FAKE_FAIL_MS = 2500

type Copy = "short" | "long" | "title-only"

type Run =
  | { kind: "idle" }
  | { kind: "timed"; copy: Copy }
  | { kind: "pending"; copy: Copy; workMs: number; fails?: ErrorButtons }

export const BusyStateSandboxScreen: React.FC = () => {
  const styles = useStyles()
  const navigation = useNavigation()
  const {
    theme: { colors, mode },
  } = useTheme()

  const [run, setRun] = React.useState<Run>({ kind: "idle" })
  const [workDone, setWorkDone] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)

  // A real adopter sets these in its route options. The sandbox shares its
  // route with the menu, so it flips them while a run is on screen.
  React.useLayoutEffect(() => {
    const idle = run.kind === "idle"
    navigation.setOptions({ headerShown: idle, gestureEnabled: idle })
  }, [navigation, run.kind])
  const [startedAt, setStartedAt] = React.useState(0)
  const [lastRunMs, setLastRunMs] = React.useState<number | null>(null)

  const start = React.useCallback((next: Run) => {
    setWorkDone(false)
    setFailed(false)
    setAttempt(0)
    setLastRunMs(null)
    setStartedAt(Date.now())
    setRun(next)
  }, [])

  // The fake job. Only runs in `pending` mode; `timed` has no work behind it.
  // A failing run fails its first attempt and succeeds on retry.
  React.useEffect(() => {
    if (run.kind !== "pending") return

    const willFail = Boolean(run.fails) && attempt === 0
    const timer = setTimeout(
      () => (willFail ? setFailed(true) : setWorkDone(true)),
      run.workMs,
    )

    return () => clearTimeout(timer)
  }, [run, attempt])

  const onDone = React.useCallback(() => {
    setLastRunMs(Date.now() - startedAt)
    setRun({ kind: "idle" })
  }, [startedAt])

  if (run.kind !== "idle") {
    const stop = () => setRun({ kind: "idle" })
    const retry = () => {
      setFailed(false)
      setAttempt((n) => n + 1)
    }

    const fails = run.kind === "pending" ? run.fails : undefined
    const error: BusyStateError | undefined =
      failed && fails
        ? {
            title: ERROR_TITLE,
            body: ERROR_BODY,
            onRetry: fails === "back" ? undefined : retry,
            onBack: stop,
            onClose: fails === "retry-back-close" ? stop : undefined,
          }
        : undefined

    return (
      <BusyStateScreen
        icon1={
          <GaloyIcon name="key-outline" size={CHIP_GLYPH_SIZE} color={colors._green} />
        }
        icon2={<GaloyIcon name="share" size={CHIP_GLYPH_SIZE} color={colors.black} />}
        title={run.copy === "long" ? LONG_TITLE : SHORT_TITLE}
        body={
          run.copy === "title-only"
            ? undefined
            : run.copy === "long"
              ? LONG_BODY
              : SHORT_BODY
        }
        completion={
          run.kind === "timed" ? { kind: "timed" } : { kind: "pending", done: workDone }
        }
        onDone={onDone}
        error={error}
      />
    )
  }

  return (
    <Screen preset="scroll">
      <View style={styles.body}>
        <Text type="h1" bold>
          Busy state sandbox
        </Text>
        <Text type="p3" style={styles.note}>
          Theme is {mode}. Change it in Settings → Preferences to check the other one;
          nothing here pins a colour.
        </Text>

        {lastRunMs !== null && (
          <Text type="p3" style={styles.note}>
            Last run held for {lastRunMs}ms.
          </Text>
        )}

        <Text type="p2" bold style={styles.sectionTitle}>
          Timed — a pure signal, no work behind it
        </Text>
        <Button
          title={`Run timed (${SIGNAL_MS}ms)`}
          onPress={() => start({ kind: "timed", copy: "short" })}
        />
        <Button
          title="Run timed, long copy"
          onPress={() => start({ kind: "timed", copy: "long" })}
        />
        <Button
          title="Run timed, title only (no body)"
          onPress={() => start({ kind: "timed", copy: "title-only" })}
        />

        <Text type="p2" bold style={styles.sectionTitle}>
          Pending — ends when the work does
        </Text>
        <Button
          title={`Run pending (${FAKE_WORK_MS}ms job)`}
          onPress={() => start({ kind: "pending", copy: "short", workMs: FAKE_WORK_MS })}
        />
        <Button
          title={`Run pending (${FAKE_INSTANT_WORK_MS}ms job — floor test)`}
          onPress={() =>
            start({ kind: "pending", copy: "short", workMs: FAKE_INSTANT_WORK_MS })
          }
        />
        <Text type="p3" style={styles.note}>
          The floor test should still hold for the full entrance, not flash.
        </Text>

        <Text type="p2" bold style={styles.sectionTitle}>
          Error — the job fails once, then succeeds on Try Again
        </Text>
        <Button
          title="Fail: Try Again + Back"
          onPress={() =>
            start({
              kind: "pending",
              copy: "short",
              workMs: FAKE_FAIL_MS,
              fails: "retry-back",
            })
          }
        />
        <Button
          title="Fail: Back only (Figma)"
          onPress={() =>
            start({ kind: "pending", copy: "short", workMs: FAKE_FAIL_MS, fails: "back" })
          }
        />
        <Button
          title="Fail: Try Again + Back + Close"
          onPress={() =>
            start({
              kind: "pending",
              copy: "short",
              workMs: FAKE_FAIL_MS,
              fails: "retry-back-close",
            })
          }
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  sectionTitle: {
    marginTop: 14,
  },
  note: {
    color: colors.grey2,
  },
}))
