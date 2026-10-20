import { useErrorHaptic } from "@app/hooks/use-error-haptic"

import { DestinationState } from "../send-bitcoin-reducer"

/** A destination that didn't check out. Next stays off, and each failed check buzzes the
 *  light refusal: editing the text leaves the state, so the next failure buzzes again. */
const DESTINATION_ERROR_STATES: ReadonlySet<string> = new Set([
  DestinationState.Invalid,
  DestinationState.PhoneInvalid,
  DestinationState.PhoneNotAllowed,
])

/** Whether step 1's destination failed its check, with the refusal haptic for it. */
export const useDestinationErrorFeedback = (destinationState: string): boolean => {
  const isError = DESTINATION_ERROR_STATES.has(destinationState)
  useErrorHaptic(isError ? destinationState : undefined, "reject")
  return isError
}
