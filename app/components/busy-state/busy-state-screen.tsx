import React, { useEffect, useRef, useState } from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { testProps } from "@app/utils/testProps"

import { BusyStateAnimation, type BusyStateAnimationProps } from "./busy-state-animation"
import {
  HEADING_TO_STATUS_GAP,
  MIN_VISIBLE_MS,
  ROW_TO_TEXT_GAP,
  ROW_TOP_PADDING,
  SIGNAL_MS,
  TEXT_BLOCK_WIDTH,
} from "./config"

export type BusyCompletion =
  /**
   * Real asynchronous work. Ends as soon as `done` turns true, but never before
   * the entrance has finished.
   */
  | { kind: "pending"; done: boolean }
  /**
   * A pure signal: a background change, transfer or process that needs no user
   * action and has no observable completion. Holds long enough to be read.
   */
  | { kind: "timed"; durationMs?: number }

export type BusyStateScreenProps = BusyStateAnimationProps & {
  heading: string
  /** The status line. Its trailing ellipsis is part of the copy. */
  status: string
  completion: BusyCompletion
  /** Called exactly once, when the floor has elapsed and the work has finished. */
  onDone: () => void
}

/**
 * The universal busy state: a pictogram, a heading and a status line, held on
 * screen while something happens elsewhere.
 *
 * **The caller must keep this mounted until `onDone` fires.** Rendering it as
 * `{loading && <BusyStateScreen … />}` defeats the whole point: the component
 * unmounts the instant the work finishes, so a request that returns in 80ms
 * flashes the screen and is gone. Drive visibility from `onDone` instead:
 *
 * ```tsx
 * {busy && (
 *   <BusyStateScreen
 *     completion={{ kind: "pending", done: !loading }}
 *     onDone={() => setBusy(false)}
 *     …
 *   />
 * )}
 * ```
 *
 * This screen never navigates and never renders an error. It reports that it is
 * finished; the caller decides where to go and what to show if the work failed.
 */
export const BusyStateScreen: React.FC<BusyStateScreenProps> = ({
  heading,
  status,
  completion,
  onDone,
  ...animation
}) => {
  const styles = useStyles()

  const [floorElapsed, setFloorElapsed] = useState(false)
  const doneRef = useRef(false)

  const holdMs =
    completion.kind === "timed"
      ? Math.max(completion.durationMs ?? SIGNAL_MS, MIN_VISIBLE_MS)
      : MIN_VISIBLE_MS

  useEffect(() => {
    const timer = setTimeout(() => setFloorElapsed(true), holdMs)

    return () => clearTimeout(timer)
  }, [holdMs])

  const workFinished = completion.kind === "timed" || completion.done

  useEffect(() => {
    if (!floorElapsed || !workFinished || doneRef.current) return

    doneRef.current = true
    onDone()
  }, [floorElapsed, workFinished, onDone])

  return (
    <Screen preset="fixed" headerShown={false}>
      <View
        style={styles.body}
        accessibilityRole="progressbar"
        accessibilityLabel={heading}
        accessibilityValue={{ text: status }}
      >
        <View style={styles.pictogram}>
          <BusyStateAnimation {...animation} />
        </View>

        <View style={styles.text}>
          <Text
            type="h2"
            bold
            style={styles.heading}
            {...testProps("busy-state-heading")}
          >
            {heading}
          </Text>
          <Text type="p3" style={styles.status} {...testProps("busy-state-status")}>
            {status}
          </Text>
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: ROW_TO_TEXT_GAP,
  },
  pictogram: {
    paddingTop: ROW_TOP_PADDING,
  },
  text: {
    width: TEXT_BLOCK_WIDTH,
    maxWidth: "100%",
    gap: HEADING_TO_STATUS_GAP,
  },
  heading: {
    color: colors.black,
    textAlign: "center",
  },
  status: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
