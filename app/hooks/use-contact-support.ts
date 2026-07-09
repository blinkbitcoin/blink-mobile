import { useCallback } from "react"
import { Linking } from "react-native"

import { useRemoteConfig } from "@app/config/feature-flags-context"

type SupportEmailDraft = {
  subject: string
  body: string
}

type UseContactSupport = {
  feedbackEmailAddress: string
  openSupport: () => void
  composeSupport: (draft: SupportEmailDraft) => void
}

/**
 * Opens the configured support inbox and exposes the address for display. It centralizes
 * the `mailto:` action that several screens would otherwise inline against
 * useRemoteConfig().feedbackEmailAddress. composeSupport opens the same inbox with a
 * pre-filled subject and body, for flows that attach diagnostics.
 */
export const useContactSupport = (): UseContactSupport => {
  const { feedbackEmailAddress } = useRemoteConfig()

  const openSupport = useCallback(
    () => Linking.openURL(`mailto:${feedbackEmailAddress}`),
    [feedbackEmailAddress],
  )

  const composeSupport = useCallback(
    ({ subject, body }: SupportEmailDraft) =>
      Linking.openURL(
        `mailto:${feedbackEmailAddress}?subject=${encodeURIComponent(
          subject,
        )}&body=${encodeURIComponent(body)}`,
      ),
    [feedbackEmailAddress],
  )

  return { feedbackEmailAddress, openSupport, composeSupport }
}
