import React from "react"
import { Linking } from "react-native"
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated"
import { useIsFocused } from "@react-navigation/native"

import { BLINK_DEEP_LINK_PREFIX } from "@app/config"
import { useBounceInAnimation } from "@app/components/animations"
import {
  BulletinsDocument,
  BulletinsQuery,
  useStatefulNotificationAcknowledgeMutation,
} from "@app/graphql/generated"

import { useNotifications } from "."
import { NotificationCardUI } from "./notification-card-ui"
import { IconNamesType } from "../atomic/galoy-icon"

type Props = {
  loading: boolean
  bulletins: BulletinsQuery | undefined
}

const BOUNCE_DELAY = 300
const BOUNCE_DURATION = 120

export const BulletinsCard: React.FC<Props> = ({ loading, bulletins }) => {
  const { cardInfo } = useNotifications()

  const [ack, { loading: ackLoading }] = useStatefulNotificationAcknowledgeMutation({
    refetchQueries: [BulletinsDocument],
  })

  const isFocused = useIsFocused()
  const scale = useSharedValue(1)
  const edges =
    bulletins?.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges ?? []
  const hasBulletins = edges.length > 0
  const hasFallbackCard = Boolean(cardInfo)
  const visible = !loading && (hasBulletins || hasFallbackCard)

  const rendered = useBounceInAnimation({
    isFocused,
    visible,
    scale,
    delay: BOUNCE_DELAY,
    duration: BOUNCE_DURATION,
  })

  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [scale],
  )

  if (loading) return null
  if (!rendered) return null

  if (
    bulletins &&
    bulletins.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges &&
    bulletins.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges.length > 0
  ) {
    return (
      <Animated.View style={animatedStyle}>
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
                ack({ variables: { input: { notificationId: bulletin.id } } })
                if (bulletin.action?.__typename === "OpenDeepLinkAction")
                  Linking.openURL(BLINK_DEEP_LINK_PREFIX + bulletin.action.deepLink)
                else if (bulletin.action?.__typename === "OpenExternalLinkAction")
                  Linking.openURL(bulletin.action.url)
              }}
              dismissAction={() =>
                ack({ variables: { input: { notificationId: bulletin.id } } })
              }
              loading={ackLoading}
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
    <Animated.View style={animatedStyle}>
      <NotificationCardUI
        title={cardInfo.title}
        text={cardInfo.text}
        icon={cardInfo.icon}
        action={cardInfo.action}
        loading={cardInfo.loading}
        dismissAction={cardInfo.dismissAction}
      />
    </Animated.View>
  )
}
