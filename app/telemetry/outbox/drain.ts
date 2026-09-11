import { isDrainPermitted, whenModeSettled } from "../mode"
import { getTelemetryTransport } from "../transport"

import type { OutboxStore } from "./store"

/**
 * The drain (AD-22, FR-72).
 *
 * Emission happens at the SDK settlement listener, so **emission order is settlement
 * order**. Submitting in insertion order would hand the receiver a per-device sequence —
 * a linkage vector arriving through the transport rather than through a field, which no
 * amount of payload discipline can close. So the queue is shuffled before it is submitted
 * and submissions are spaced by a random pause.
 *
 * What this does *not* claim: the app has no background execution — no background fetch,
 * no headless task, and the connectivity poll self-gates on foreground — so any drain runs
 * while the device is in use. **Arrival timing therefore still correlates with device
 * activity, and that is a stated residual** recorded in the affected metric contracts
 * (FR-56), not a solved problem.
 *
 * One payload at a time, never a batch: a batch would hand the receiver an explicit
 * per-device equivalence class, and shuffling the modal one-event batch is the identity
 * permutation anyway.
 */

const MAX_JITTER_MS = 1500

const shuffled = <T>(items: readonly T[]): T[] => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export type DrainDeps = {
  shuffle?: <T>(items: readonly T[]) => T[]
  delay?: (ms: number) => Promise<void>
}

export const drainOutbox = async (
  store: OutboxStore,
  { shuffle = shuffled, delay = pause }: DrainDeps = {},
): Promise<void> => {
  /** A mode change in flight owns the queue until its discard has finished. */
  await whenModeSettled()

  /** The gate covers the drain, not just capture (AD-5). An account can queue events,
   *  switch to incognito while inactive, and flush them on next activation — which is
   *  flush-then-discard by the back door, and FR-5 prohibits it outright. */
  if (!isDrainPermitted()) return

  const transport = getTelemetryTransport()
  if (!transport) return

  for (const record of shuffle(await store.pending())) {
    /** Re-checked between submissions: a mode switch mid-drain must stop the next one,
     *  and the discard it triggers must not race a submission already in flight. */
    if (!isDrainPermitted()) return

    await store.markSubmitted(record)
    const result = await transport.submit(record.event, record.payload)

    if (result.outcome === "acknowledged") await store.acknowledge(record)
    else if (result.outcome === "rejected") await store.reject(record)
    else await store.requeue(record)

    await delay(Math.floor(Math.random() * MAX_JITTER_MS))
  }
}
