import React, { useCallback, useEffect, useRef, useState } from "react"
import { BackHandler } from "react-native"
import { useFocusEffect } from "@react-navigation/native"

import { Screen } from "@app/components/screen"

import { BusyStateAnimation } from "./busy-state-animation"
import { BusyStateBody } from "./busy-state-body"
import { BusyStateErrorView, type BusyStateError } from "./busy-state-error"
import { MIN_VISIBLE_MS, SIGNAL_MS } from "./config"

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

export type BusyStateScreenProps = {
  /** Left chip glyph. Size it `CHIP_GLYPH_SIZE`. */
  icon1: React.ReactNode
  /** Right chip glyph. Size it `CHIP_GLYPH_SIZE`. */
  icon2: React.ReactNode
  /** Always rendered bold; the caller supplies the words, never the weight. */
  title: string
  /** Optional line under the title. A trailing "…" is part of the copy. */
  body?: string
  completion: BusyCompletion
  /** Called exactly once, when the floor has elapsed and the work has finished. */
  onDone: () => void
  /**
   * Set when the work failed. Replaces the busy state with the error state and
   * holds `onDone` back. Clear it to retry: the entrance and the floor start over.
   */
  error?: BusyStateError
}

type BusyStateProgressProps = Pick<
  BusyStateScreenProps,
  "icon1" | "icon2" | "title" | "body" | "completion"
> & { onFinished: () => void }

/** One attempt: the pictogram plus its floor timer. Remounted on every retry. */
const BusyStateProgress: React.FC<BusyStateProgressProps> = ({
  icon1,
  icon2,
  title,
  body,
  completion,
  onFinished,
}) => {
  const [floorElapsed, setFloorElapsed] = useState(false)

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
    if (floorElapsed && workFinished) onFinished()
  }, [floorElapsed, workFinished, onFinished])

  return (
    <BusyStateBody
      pictogram={<BusyStateAnimation icon1={icon1} icon2={icon2} />}
      title={title}
      body={body}
      testIdPrefix="busy-state"
      textAccessibility={{
        accessible: true,
        accessibilityRole: "progressbar",
        accessibilityLabel: title,
        accessibilityValue: body ? { text: body } : undefined,
      }}
    />
  )
}

/**
 * The universal busy state: two icon chips joined by a marching dashed line, a
 * title and an optional body, held on screen while something happens elsewhere.
 * If the work fails, pass `error` and it becomes the error state.
 *
 * **The route must set `headerShown: false` and `gestureEnabled: false`.**
 * `Screen`'s own `headerShown` only drives the safe-area insets. Android's
 * hardware back is handled here while the route is focused: swallowed while
 * busy, and routed to `onBack` (else `onClose`) on error, so both platforms
 * behave the same. It must render inside a navigator.
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
 * This screen never navigates. It reports that it is finished, or shows the
 * error the caller passes; the caller decides where to go.
 */
export const BusyStateScreen: React.FC<BusyStateScreenProps> = ({
  error,
  onDone,
  ...progress
}) => {
  const doneRef = useRef(false)

  const onFinished = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }, [onDone])

  const onHardwareBack = error?.onBack ?? error?.onClose

  // Scoped to focus, not mount: a native stack keeps a covered route mounted,
  // and its handler would otherwise take the press from the route on top.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        onHardwareBack?.()
        return true
      })

      return () => subscription.remove()
    }, [onHardwareBack]),
  )

  return (
    <Screen preset="fixed" headerShown={false}>
      {/* The progress view unmounts while the error shows, so clearing the
          error mounts a fresh attempt: the entrance and the floor start over. */}
      {error ? (
        <BusyStateErrorView error={error} />
      ) : (
        <BusyStateProgress {...progress} onFinished={onFinished} />
      )}
    </Screen>
  )
}
