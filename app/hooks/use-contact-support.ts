import { useCallback } from "react"
import { Linking } from "react-native"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useClipboard } from "@app/hooks/use-clipboard"

type SupportEmailDraft = {
  subject: string
  body: string
}

type UseContactSupport = {
  supportEmailAddress: string
  openSupport: () => void
  composeSupport: (draft: SupportEmailDraft) => void
}

/**
 * Opens the configured support inbox and exposes the address for display. It centralizes
 * the `mailto:` action that several screens would otherwise inline against
 * useRemoteConfig().supportEmailAddress. composeSupport opens the same inbox with a
 * pre-filled subject and body, for flows that attach diagnostics.
 */
export const useContactSupport = (): UseContactSupport => {
  const { supportEmailAddress } = useRemoteConfig()
  const { copyToClipboard } = useClipboard()

  /** Without a mail app Linking.openURL rejects; catch it and copy the address so the user
   *  is never stranded on screens whose only action is Contact us. We try-then-catch rather
   *  than gate on canOpenURL, which needs a per-scheme manifest declaration (mailto has none
   *  here) and so reports false negatives on Android 11+, wrongly copying when mail exists. */
  const openMailto = useCallback(
    async (url: string): Promise<void> => {
      try {
        await Linking.openURL(url)
      } catch {
        copyToClipboard({ content: supportEmailAddress })
      }
    },
    [supportEmailAddress, copyToClipboard],
  )

  const openSupport = useCallback(
    () => openMailto(`mailto:${supportEmailAddress}`),
    [openMailto, supportEmailAddress],
  )

  const composeSupport = useCallback(
    ({ subject, body }: SupportEmailDraft) =>
      openMailto(
        `mailto:${supportEmailAddress}?subject=${encodeURIComponent(
          subject,
        )}&body=${encodeURIComponent(body)}`,
      ),
    [openMailto, supportEmailAddress],
  )

  return { supportEmailAddress, openSupport, composeSupport }
}
