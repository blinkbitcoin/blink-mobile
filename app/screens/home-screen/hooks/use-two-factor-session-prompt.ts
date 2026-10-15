import { useCallback, useEffect, useState } from "react"

import { useIsFocused } from "@react-navigation/native"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { TwoFactorSessionPrompt, TwoFactorTier } from "@app/types/two-factor-enforcement"

type TwoFactorSessionPromptOptions = {
  /** Another home modal is up or may still arrive: the session start waits for it,
   *  since two native modals cannot present at once. */
  isBlocked: boolean
}

type TwoFactorSessionPromptState = {
  isModalOpen: boolean
  /** The tier the open modal was raised for, so its dismissal is charged to that tier
   *  even if the balance moves while it is up. */
  promptTier: TwoFactorTier
  closeModal: () => void
}

type ModalState = {
  isOpen: boolean
  tier: TwoFactorTier
}

const CLOSED: ModalState = { isOpen: false, tier: TwoFactorTier.None }

/**
 * Takes the session start from the home, and only while it is focused: a prompt must
 * never land on top of a payment or a scan. A start that owes nothing is taken at once,
 * so a balance that crosses a threshold later in the session waits for the next one. A
 * start that owes the countdown modal is taken only once the modal is resolved, closed
 * or left for a flow: while it is up the start is still pending, so a fresher read that
 * calls for the full-screen prompt instead lets the navigator stand that prompt in for
 * the home. A start that owes the full-screen prompt is the navigator's and is left
 * alone here.
 */
export const useTwoFactorSessionPrompt = ({
  isBlocked,
}: TwoFactorSessionPromptOptions): TwoFactorSessionPromptState => {
  const isFocused = useIsFocused()
  const { isSessionStartPending, requiredPrompt, unmetTier, consumeSessionStart } =
    useTwoFactorEnforcement()
  const [modal, setModal] = useState<ModalState>(CLOSED)

  const isFullScreenPromptOwed =
    requiredPrompt === TwoFactorSessionPrompt.ProtectionRequired
  const isStartDue = isFocused && !isBlocked && isSessionStartPending
  const isStartForHome = isStartDue && !isFullScreenPromptOwed && !modal.isOpen

  useEffect(() => {
    if (!isStartForHome) return
    if (requiredPrompt === TwoFactorSessionPrompt.RequiredModal) {
      setModal({ isOpen: true, tier: unmetTier })
      return
    }
    consumeSessionStart()
  }, [isStartForHome, requiredPrompt, unmetTier, consumeSessionStart])

  /** The modal was raised from the account's state as read at session start; once a
   *  fresher read says it no longer applies, the modal has nothing left to ask. The
   *  start stays pending: the effect above takes it, or the navigator does. */
  const isModalStale =
    modal.isOpen && requiredPrompt !== TwoFactorSessionPrompt.RequiredModal
  useEffect(() => {
    if (isModalStale) setModal(CLOSED)
  }, [isModalStale])

  /** Resolving the modal is what takes the start, whether it was waved away or left
   *  for one of its flows. */
  const closeModal = useCallback(() => {
    setModal(CLOSED)
    consumeSessionStart()
  }, [consumeSessionStart])

  return { isModalOpen: modal.isOpen, promptTier: modal.tier, closeModal }
}
