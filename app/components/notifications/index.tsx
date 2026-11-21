import React, {
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from "react"

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
}

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
  const [modalNotifications, setModalNotifications] = useState<NotifyModalArgs[]>([])
  const [isModalClosing, setIsModalClosing] = useState(false)
  const isModalClosingRef = useRef(false)
  /** The way out the user took, run once the pop-up is off the screen. */
  const modalExitRef = useRef<(() => void) | undefined>(undefined)
  const [cardNotifications, setCardNotifications] = useState<NotifyCardArgs[]>([])
  const [cardIsLoading, setCardIsLoading] = useState(false)

  const notifyModal = useCallback(
    (args: NotifyModalArgs) => {
      setModalNotifications((notifications) => [...notifications, args])
    },
    [setModalNotifications],
  )

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
  const activeNotification = modalNotifications[0]

  /**
   * One way out per pop-up: a second tap while it closes, on the button or the backdrop,
   * is not taken, even when both land before the next render. What it leads to runs once
   * the pop-up is off the screen, so a route it takes (the login gate raises a biometric
   * prompt as it opens) is never covered by it, and a pop-up the action raises shows
   * after this one.
   */
  const closeModal = useCallback((exit?: () => void) => {
    if (isModalClosingRef.current) return
    isModalClosingRef.current = true
    modalExitRef.current = exit
    setIsModalClosing(true)
  }, [])

  const onModalHide = useCallback(() => {
    const exit = modalExitRef.current
    modalExitRef.current = undefined
    isModalClosingRef.current = false
    setModalNotifications((notifications) => notifications.slice(1))
    setIsModalClosing(false)
    exit?.()
  }, [])

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
          isVisible={!isModalClosing}
          onClose={() => closeModal(activeNotification.dismissAction)}
          onModalHide={onModalHide}
          icon={activeNotification.icon}
          title={activeNotification.title}
          text={activeNotification.text}
          buttonTitle={activeNotification.primaryButtonTitle}
          onButtonPress={() => closeModal(activeNotification.primaryButtonAction)}
        />
      )}
    </NotificationModalContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationModalContext)
