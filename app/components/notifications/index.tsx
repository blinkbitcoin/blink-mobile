import React, {
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react"

import { useAuthenticationContext } from "@app/navigation/authentication-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveSessionKey } from "@app/store/persistent-state/account-key"

import { IconNamesType } from "../atomic/galoy-icon"
import { MessagePopup } from "./message-popup"

export { MessagePopup } from "./message-popup"

/** What a message tells the user, which picks its icon: the action worked; something
 *  failed and nothing is lost; something failed and the user could lose something if
 *  they ignore it; or neutral news. */
export const MessageIcon = {
  Success: "payment-success",
  Alert: "warning-circle",
  Warning: "warning",
  Info: "info",
} as const satisfies Record<string, IconNamesType>

type NotifyModalArgs = {
  title: string
  text: string
  icon?: IconNamesType
  primaryButtonTitle: string
  /** The button's remedy, or the follow-up a message that only informs leads to. */
  primaryButtonAction?: () => void
  /** The close icon, the backdrop and the back button. */
  dismissAction?: () => void
  /**
   * A message whose way out finishes what the user started: leaving a flow that is done,
   * or a page that cannot work, or the session that just ended. It stays until the user
   * answers it, through the app relocking too, and comes back once the lock is answered,
   * so the user can never carry on without its way out having run. Any other message
   * only informs or offers a remedy the screen still offers, and a relock drops it.
   */
  isRequired?: boolean
}

/** A message in the queue, with the relocks that had happened when it was raised. */
type QueuedModal = NotifyModalArgs & { id: number; lockCount: number }

type NotifyCardArgs = {
  title: string
  text: string
  icon?: IconNamesType
  action: () => Promise<void>
  dismissAction?: () => void
}

type NotificationModalContextType = {
  notifyModal: (args: NotifyModalArgs) => void
  notifyCard: (args: NotifyCardArgs) => void
  cardInfo: NotificationCardProps | undefined
}

type NotificationCardProps = {
  title: string
  text: string
  icon?: IconNamesType
  action: () => Promise<void>
  loading?: boolean
  dismissAction?: () => void
}

export const NotificationModalContext = createContext<NotificationModalContextType>({
  notifyModal: () => {},
  notifyCard: () => {},
  cardInfo: undefined,
})

export const NotificationsProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [modalNotifications, setModalNotifications] = useState<QueuedModal[]>([])
  const nextModalIdRef = useRef(0)
  /** The pop-up closing and the way out the user took, run once it is off the screen. */
  const [closingModalId, setClosingModalId] = useState<number | undefined>(undefined)
  const closingModalRef = useRef<{ id: number; exit?: () => void } | undefined>(undefined)
  const [cardNotifications, setCardNotifications] = useState<NotifyCardArgs[]>([])
  const [cardIsLoading, setCardIsLoading] = useState(false)

  /**
   * The resume relock pushes the unlock screen under the global pop-up, which would stay
   * on top of it and answerable: a way out taken there runs from under the lock, where a
   * screen's own route is not in front and its follow-up is lost, and a copy lands on the
   * phone's clipboard before anyone unlocked. So a pop-up raised before a lock is never
   * shown while that lock is up. Counted in render, so the pop-up is gone in the same
   * commit as the lock comes up, with no frame in which it can still be pressed.
   */
  const { isAppLocked, readIsAppLocked } = useAuthenticationContext()
  const lockCountRef = useRef(0)
  const wasAppLockedRef = useRef(isAppLocked)
  if (isAppLocked && !wasAppLockedRef.current) lockCountRef.current += 1
  wasAppLockedRef.current = isAppLocked
  const lockCount = lockCountRef.current

  const isUnderLock = useCallback(
    (notification: QueuedModal) =>
      readIsAppLocked() && notification.lockCount < lockCountRef.current,
    [readIsAppLocked],
  )

  const notifyModal = useCallback(
    (args: NotifyModalArgs) => {
      const id = nextModalIdRef.current
      nextModalIdRef.current += 1
      setModalNotifications((notifications) => [
        ...notifications,
        { ...args, id, lockCount: lockCountRef.current },
      ])
    },
    [setModalNotifications],
  )

  /**
   * A lock drops the messages that only inform, and stops any way out still closing: the
   * pop-up came off the screen without its follow-up running, so it is owed again and
   * comes back after the unlock rather than being taken from under the lock.
   */
  useEffect(() => {
    if (lockCount === 0) return
    closingModalRef.current = undefined
    setClosingModalId(undefined)
    setModalNotifications((notifications) =>
      notifications.filter(
        (notification) => notification.isRequired || notification.lockCount === lockCount,
      ),
    )
  }, [lockCount])

  /** A message held behind the lock belongs to the session it was raised in: one ended
   *  from the lock screen, or switched away from, must not greet the next one, nor take
   *  its way out (a logout's leads to the gate) from inside it. */
  const { persistentState } = usePersistentStateContext()
  const sessionKey = resolveSessionKey(persistentState)
  const sessionKeyRef = useRef(sessionKey)
  useEffect(() => {
    if (sessionKeyRef.current === sessionKey) return
    sessionKeyRef.current = sessionKey
    setModalNotifications((notifications) =>
      notifications.filter((notification) => !isUnderLock(notification)),
    )
  }, [sessionKey, isUnderLock])

  const notifyCard = useCallback(
    (args: NotifyCardArgs) => {
      setCardNotifications((notifications) => [...notifications, args])
    },
    [setCardNotifications],
  )

  const dismissCard = useCallback(() => {
    setCardNotifications((notifications) => notifications.slice(1))
  }, [setCardNotifications])

  const activeCard = cardNotifications[0]
  const activeNotification = modalNotifications.find(
    (notification) =>
      (notification.isRequired || notification.lockCount === lockCount) &&
      !(isAppLocked && notification.lockCount < lockCount),
  )

  /**
   * One way out per pop-up: a second tap while it closes, on the button or the backdrop,
   * is not taken, even when both land before the next render. What it leads to runs once
   * the pop-up is off the screen, so a route it takes (the login gate raises a biometric
   * prompt as it opens) is never covered by it, and a pop-up the action raises shows
   * after this one.
   */
  const closeModal = useCallback((id: number, exit?: () => void) => {
    if (closingModalRef.current) return
    closingModalRef.current = { id, exit }
    setClosingModalId(id)
  }, [])

  const onModalHide = useCallback(() => {
    const closing = closingModalRef.current
    if (!closing) return
    closingModalRef.current = undefined
    setClosingModalId(undefined)

    /** A lock that came up while it was closing keeps it: it is answered after the
     *  unlock, with its screen in front again. */
    const notification = modalNotifications.find(({ id }) => id === closing.id)
    if (notification && isUnderLock(notification)) return

    setModalNotifications((notifications) =>
      notifications.filter(({ id }) => id !== closing.id),
    )
    closing.exit?.()
  }, [modalNotifications, isUnderLock])

  const cardInfo = useMemo(() => {
    if (!activeCard) {
      return undefined
    }

    const action = async () => {
      setCardIsLoading(true)
      await activeCard.action()
      dismissCard()
      setCardIsLoading(false)
    }

    const dismissAction = () => {
      dismissCard()
      if (activeCard.dismissAction) {
        activeCard.dismissAction()
      }
    }

    return {
      title: activeCard.title,
      text: activeCard.text,
      icon: activeCard.icon,
      action,
      loading: cardIsLoading,
      dismissAction,
    }
  }, [activeCard, dismissCard, cardIsLoading])

  return (
    <NotificationModalContext.Provider
      value={{
        notifyModal,
        notifyCard,
        cardInfo,
      }}
    >
      {children}

      {activeNotification && (
        <MessagePopup
          key={activeNotification.id}
          isVisible={closingModalId !== activeNotification.id}
          onClose={() =>
            closeModal(activeNotification.id, activeNotification.dismissAction)
          }
          onModalHide={onModalHide}
          icon={activeNotification.icon}
          title={activeNotification.title}
          text={activeNotification.text}
          buttonTitle={activeNotification.primaryButtonTitle}
          onButtonPress={() =>
            closeModal(activeNotification.id, activeNotification.primaryButtonAction)
          }
        />
      )}
    </NotificationModalContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationModalContext)
