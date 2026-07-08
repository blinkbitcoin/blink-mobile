import { useCallback } from "react"
import { Linking } from "react-native"

import { useRemoteConfig } from "@app/config/feature-flags-context"

type UseContactSupport = {
  feedbackEmailAddress: string
  openSupport: () => void
}

/**
 * Opens the configured support inbox and exposes the address for display. It centralizes
 * the `mailto:` action that several screens would otherwise inline against
 * useRemoteConfig().feedbackEmailAddress.
 */
export const useContactSupport = (): UseContactSupport => {
  const { feedbackEmailAddress } = useRemoteConfig()

  const openSupport = useCallback(
    () => Linking.openURL(`mailto:${feedbackEmailAddress}`),
    [feedbackEmailAddress],
  )

  return { feedbackEmailAddress, openSupport }
}
