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
 * never land on top of a payment or a scan. The start is taken whether or not it owes
 * a prompt, so a balance that crosses a threshold later in the session waits for the
 * next one. The countdown modal is the home's own to open and close; the full-screen
 * prompt never reaches here, since it stands in for the home until its start is taken.
 */
export const useTwoFactorSessionPrompt = ({
  isBlocked,
}: TwoFactorSessionPromptOptions): TwoFactorSessionPromptState => {
  const isFocused = useIsFocused()
  const { isSessionStartPending, requiredPrompt, unmetTier, consumeSessionStart } =
    useTwoFactorEnforcement()
  const [modal, setModal] = useState<ModalState>(CLOSED)

  const isStartDue = isFocused && !isBlocked && isSessionStartPending

  useEffect(() => {
    if (!isStartDue) return
    consumeSessionStart()
    if (requiredPrompt === TwoFactorSessionPrompt.RequiredModal) {
      setModal({ isOpen: true, tier: unmetTier })
    }
  }, [isStartDue, requiredPrompt, unmetTier, consumeSessionStart])

  /** The modal was raised from the account's state as read at session start; once a
   *  fresher read says it no longer applies, the modal has nothing left to ask. */
  const isModalStale =
    modal.isOpen && requiredPrompt !== TwoFactorSessionPrompt.RequiredModal
  useEffect(() => {
    if (isModalStale) setModal(CLOSED)
  }, [isModalStale])

  const closeModal = useCallback(() => setModal(CLOSED), [])

  return { isModalOpen: modal.isOpen, promptTier: modal.tier, closeModal }
}
