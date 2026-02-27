import React from "react"
import { Animated, Linking } from "react-native"
import { useApolloClient } from "@apollo/client"

import { useNotifications } from "."
import { NotificationCardUI } from "./notification-card-ui"
import { useDropInOutAnimation } from "@app/components/animations"
import {
  BulletinsDocument,
  BulletinsQuery,
  useStatefulNotificationAcknowledgeMutation,
} from "@app/graphql/generated"
import { BLINK_DEEP_LINK_PREFIX } from "@app/config"
import { IconNamesType } from "../atomic/galoy-icon"

type Props = {
  loading: boolean
  bulletins: BulletinsQuery | undefined
}

const BULLETIN_ANIMATION = {
  delay: 300,
  distance: 50,
  durationIn: 200,
  durationOut: 120,
}

export const BulletinsCard: React.FC<Props> = ({ loading, bulletins }) => {
  const { cardInfo } = useNotifications()
  const [dismissing, setDismissing] = React.useState(false)
  const client = useApolloClient()

  const [ack, { loading: ackLoading }] = useStatefulNotificationAcknowledgeMutation()

  const dismissWithAnimation = React.useCallback(
    async (notificationId: string, afterAck?: () => void) => {
      await ack({ variables: { input: { notificationId } } })
      afterAck?.()
      setDismissing(true)
      setTimeout(() => {
        client.refetchQueries({ include: [BulletinsDocument] })
        setDismissing(false)
      }, BULLETIN_ANIMATION.durationOut)
    },
    [ack, client],
  )

  const hasBulletins =
    !loading &&
    bulletins &&
    bulletins.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges &&
    bulletins.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges.length > 0

  const { opacity, translateY } = useDropInOutAnimation({
    visible: Boolean(hasBulletins) && !dismissing,
    ...BULLETIN_ANIMATION,
  })

  if (loading) return null

  if (hasBulletins) {
    return (
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        {bulletins.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges.map(
          ({ node: bulletin }) => (
            <NotificationCardUI
              icon={
                bulletin.icon
                  ? (bulletin.icon.toLowerCase().replace("_", "-") as IconNamesType)
                  : undefined
              }
              key={bulletin.id}
              title={bulletin.title}
              text={bulletin.body}
              action={async () => {
                if (bulletin.action?.__typename === "OpenDeepLinkAction")
                  Linking.openURL(BLINK_DEEP_LINK_PREFIX + bulletin.action.deepLink)
                else if (bulletin.action?.__typename === "OpenExternalLinkAction")
                  Linking.openURL(bulletin.action.url)
                await dismissWithAnimation(bulletin.id)
              }}
              dismissAction={() => dismissWithAnimation(bulletin.id)}
              loading={ackLoading}
              buttonLabel={bulletin.action?.label ?? undefined}
            />
          ),
        )}
      </Animated.View>
    )
  }

  if (!cardInfo) {
    return null
  }

  return (
    <NotificationCardUI
      title={cardInfo.title}
      text={cardInfo.text}
      icon={cardInfo.icon}
      action={cardInfo.action}
      loading={cardInfo.loading}
      dismissAction={cardInfo.dismissAction}
    />
  )
}
