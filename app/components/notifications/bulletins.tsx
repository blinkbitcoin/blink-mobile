import React from "react"
import { Linking } from "react-native"

import { useNotifications } from "."
import { NotificationCardUI } from "./notification-card-ui"
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

export const BulletinsCard: React.FC<Props> = ({ loading, bulletins }) => {
  const { cardInfo } = useNotifications()

  const [ack, { loading: ackLoading }] = useStatefulNotificationAcknowledgeMutation({
    refetchQueries: [BulletinsDocument],
  })

  if (loading) return null

  if (
    bulletins &&
    bulletins.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges &&
    bulletins.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges.length > 0
  ) {
    return (
      <>
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
              buttonLabel={bulletin.bulletinButton?.label}
            />
          ),
        )}
      </>
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
