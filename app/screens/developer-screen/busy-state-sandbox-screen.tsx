import * as React from "react"
import { View } from "react-native"

import { Button, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { BusyStateScreen, CHIP_GLYPH_SIZE, SIGNAL_MS } from "@app/components/busy-state"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"

/**
 * A throwaway harness for the universal busy state, reachable from the developer
 * screen. It is wired to nothing: no query, no navigation, no real work — the
 * point is to judge the motion and the copy on a device before any production
 * screen adopts the component.
 *
 * The glyphs here are stand-ins. `galoy-icon` has no Nostr/ostrich entry yet, so
 * the second chip borrows `share` (a network glyph). Whatever screen adopts this
 * first brings its own icons.
 */

const SHORT_HEADING = "Your backup phrase is used to create your Nostr keys"
const SHORT_STATUS = "Generating keys…"

const LONG_HEADING =
  "Deine Wiederherstellungsphrase wird verwendet, um deine Nostr-Schlüssel zu erzeugen und zu sichern"
const LONG_STATUS = "Schlüssel werden erzeugt und im Gerätespeicher abgelegt…"

/** How long the fake async job takes in `pending` mode. */
const FAKE_WORK_MS = 6000
/** A job that finishes faster than the entrance, to prove the floor holds. */
const FAKE_INSTANT_WORK_MS = 80

type Run =
  | { kind: "idle" }
  | { kind: "timed"; long: boolean }
  | { kind: "pending"; long: boolean; workMs: number }

export const BusyStateSandboxScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors, mode },
  } = useTheme()

  const [run, setRun] = React.useState<Run>({ kind: "idle" })
  const [workDone, setWorkDone] = React.useState(false)
  const [startedAt, setStartedAt] = React.useState(0)
  const [lastRunMs, setLastRunMs] = React.useState<number | null>(null)

  const start = React.useCallback((next: Run) => {
    setWorkDone(false)
    setLastRunMs(null)
    setStartedAt(Date.now())
    setRun(next)
  }, [])

  // The fake job. Only runs in `pending` mode; `timed` has no work behind it.
  React.useEffect(() => {
    if (run.kind !== "pending") return

    const timer = setTimeout(() => setWorkDone(true), run.workMs)

    return () => clearTimeout(timer)
  }, [run])

  const onDone = React.useCallback(() => {
    setLastRunMs(Date.now() - startedAt)
    setRun({ kind: "idle" })
  }, [startedAt])

  if (run.kind !== "idle") {
    const long = run.long

    return (
      <BusyStateScreen
        from={{
          icon: (
            <GaloyIcon name="key-outline" size={CHIP_GLYPH_SIZE} color={colors._green} />
          ),
        }}
        to={{
          icon: <GaloyIcon name="share" size={CHIP_GLYPH_SIZE} color={colors.black} />,
        }}
        heading={long ? LONG_HEADING : SHORT_HEADING}
        status={long ? LONG_STATUS : SHORT_STATUS}
        completion={
          run.kind === "timed" ? { kind: "timed" } : { kind: "pending", done: workDone }
        }
        onDone={onDone}
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
          onPress={() => start({ kind: "timed", long: false })}
        />
        <Button
          title="Run timed, long copy"
          onPress={() => start({ kind: "timed", long: true })}
        />

        <Text type="p2" bold style={styles.sectionTitle}>
          Pending — ends when the work does
        </Text>
        <Button
          title={`Run pending (${FAKE_WORK_MS}ms job)`}
          onPress={() => start({ kind: "pending", long: false, workMs: FAKE_WORK_MS })}
        />
        <Button
          title={`Run pending (${FAKE_INSTANT_WORK_MS}ms job — floor test)`}
          onPress={() =>
            start({ kind: "pending", long: false, workMs: FAKE_INSTANT_WORK_MS })
          }
        />
        <Text type="p3" style={styles.note}>
          The floor test should still hold for the full entrance, not flash.
        </Text>
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
