import { useEffect, useState } from "react"

import { useIsFocused } from "@react-navigation/native"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import {
  TwoFactorPrompt,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"
import { logTwoFactorPromptShown } from "@app/utils/analytics"

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
 * start that owes the high-balance modal stays pending for as long as the modal is up,
 * and the modal stays up, hidden with the home, while the user is away in a flow it
 * opened. The modal comes down once the start is taken, by the dismissal the modal or
 * the flow reports, or once the account complies. A start the navigator stands the
 * blocking screen in for is left to it; one whose blocking screen yielded to the
 * wind-down is taken here with no prompt, since the wind-down's push is what the home
 * shows for it. The yield and the push are judged from the session's one wind-down
 * read, so they cannot disagree.
 */
export const useTwoFactorSessionPrompt = ({
  isBlocked,
}: TwoFactorSessionPromptOptions): TwoFactorSessionPromptState => {
  const isFocused = useIsFocused()
  const {
    isSessionStartPending,
    isProtectionGateActive,
    requiredPrompt,
    unmetTier,
    consumeSessionStart,
  } = useTwoFactorEnforcement()
  const [modal, setModal] = useState<ModalState>(CLOSED)

  const isStartDue = isFocused && !isBlocked && isSessionStartPending
  const isStartForHome = isStartDue && !isProtectionGateActive && !modal.isOpen

  /** The modal is logged as shown when it is raised, not when it is visible: it is
   *  hidden and shown again with the home's focus while it stays up. */
  useEffect(() => {
    if (!isStartForHome) return
    if (requiredPrompt === TwoFactorSessionPrompt.SessionModal) {
      setModal({ isOpen: true, tier: unmetTier })
      logTwoFactorPromptShown({ tier: unmetTier, prompt: TwoFactorPrompt.SessionModal })
      return
    }
    consumeSessionStart()
  }, [isStartForHome, requiredPrompt, unmetTier, consumeSessionStart])

  /** The modal was raised for the start as read at session start, and has nothing left
   *  to ask once that start is taken, or once a fresher read says the modal no longer
   *  applies: the effect above then takes the start, or the navigator does. */
  const isStartTaken = !isSessionStartPending
  const isModalOutgrown = requiredPrompt !== TwoFactorSessionPrompt.SessionModal
  const isModalStale = modal.isOpen && (isStartTaken || isModalOutgrown)
  useEffect(() => {
    if (isModalStale) setModal(CLOSED)
  }, [isModalStale])

  return { isModalOpen: modal.isOpen, promptTier: modal.tier }
}
