import React, { useState, createContext, useContext, useCallback, useMemo } from "react"

import { Text, makeStyles, useTheme } from "@rneui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"
import CustomModal from "../custom-modal/custom-modal"

type NotifyModalArgs = {
  title: string
  text: string
  icon?: IconNamesType
  primaryButtonTitle: string
  primaryButtonAction?: () => Promise<void>
  secondaryButtonTitle?: string
  secondaryButtonAction?: () => Promise<void>
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
  const [modalPrimaryIsLoading, setModalPrimaryIsLoading] = useState(false)
  const [modalSecondaryIsLoading, setModalSecondaryIsLoading] = useState(false)
  const [cardNotifications, setCardNotifications] = useState<NotifyCardArgs[]>([])
  const [cardIsLoading, setCardIsLoading] = useState(false)

  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const notifyModal = useCallback(
    (args: NotifyModalArgs) => {
      setModalNotifications((notifications) => [...notifications, args])
    },
    [setModalNotifications],
  )

  const dismissModal = useCallback(() => {
    setModalNotifications((notifications) => notifications.slice(1))
  }, [setModalNotifications])

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

  const modalInfo = useMemo(() => {
    if (!activeNotification) {
      return null
    }

    const toggleModal = () => {
      dismissModal()
      if (activeNotification.dismissAction) {
        activeNotification.dismissAction()
      }
    }

    const primaryButtonAction = async () => {
      if (activeNotification.primaryButtonAction) {
        setModalPrimaryIsLoading(true)
        await activeNotification.primaryButtonAction()
        setModalPrimaryIsLoading(false)
      }
      dismissModal()
    }

    const secondaryButtonAction = async () => {
      if (activeNotification.secondaryButtonAction) {
        setModalSecondaryIsLoading(true)
        await activeNotification.secondaryButtonAction()
        setModalSecondaryIsLoading(false)
      }
      dismissModal()
    }

    return {
      title: activeNotification.title,
      isVisible: Boolean(activeNotification),
      toggleModal,
      showCloseIcon: Boolean(activeNotification.dismissAction),
      primaryButtonTitle: activeNotification.primaryButtonTitle,
      primaryButtonAction,
      secondaryButtonTitle: activeNotification.secondaryButtonTitle,
      secondaryButtonAction,
      text: activeNotification.text,
      icon: activeNotification.icon,
    }
  }, [
    activeNotification,
    dismissModal,
    setModalPrimaryIsLoading,
    setModalSecondaryIsLoading,
  ])

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

      {modalInfo && (
        <CustomModal
          isVisible={modalInfo.isVisible}
          toggleModal={modalInfo.toggleModal}
          title={modalInfo.title}
          showCloseIconButton={modalInfo.showCloseIcon}
          primaryButtonTitle={modalInfo.primaryButtonTitle}
          primaryButtonOnPress={modalInfo.primaryButtonAction}
          primaryButtonLoading={modalPrimaryIsLoading}
          secondaryButtonOnPress={modalInfo.secondaryButtonAction}
          secondaryButtonTitle={modalInfo.secondaryButtonTitle}
          secondaryButtonLoading={modalSecondaryIsLoading}
          image={
            modalInfo.icon && (
              <GaloyIcon
                name={modalInfo.icon as IconNamesType}
                size={100}
                color={colors.primary3}
              />
            )
          }
          body={
            <Text type="h2" style={styles.bodyText}>
              {modalInfo.text}
            </Text>
          }
        />
      )}
    </NotificationModalContext.Provider>
  )
}

const useStyles = makeStyles(() => ({
  bodyText: {
    textAlign: "center",
  },
}))

export const useNotifications = () => useContext(NotificationModalContext)
