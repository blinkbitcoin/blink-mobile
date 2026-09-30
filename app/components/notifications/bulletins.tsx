import React from "react"
import { Animated, Linking } from "react-native"
import { useApolloClient } from "@apollo/client"

import { useNotifications } from "."
import { NotificationCardUI } from "./notification-card-ui"
import { testBulletinsStore, useTestBulletins } from "./test-bulletins-store"
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

type Bulletin = NonNullable<
  BulletinsQuery["me"]
>["unacknowledgedStatefulNotificationsWithBulletinEnabled"]["edges"][number]["node"]

/** The address a bulletin's action opens, or null when it has none. */
const linkOf = (action: Bulletin["action"]): string | null => {
  if (action?.__typename === "OpenDeepLinkAction") {
    return BLINK_DEEP_LINK_PREFIX + action.deepLink
  }
  if (action?.__typename === "OpenExternalLinkAction") return action.url
  return null
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
  const testBulletins = useTestBulletins()

  const [ack, { loading: ackLoading }] = useStatefulNotificationAcknowledgeMutation()

  const dismissWithAnimation = React.useCallback(
    async (notificationId: string, afterAck?: () => void) => {
      try {
        await ack({ variables: { input: { notificationId } } })
      } catch (e) {
        console.error("Failed to acknowledge notification", e)
        return
      }
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

  const hasTestBulletins = __DEV__ && testBulletins.length > 0

  const { opacity, translateY } = useDropInOutAnimation({
    visible: (Boolean(hasBulletins) || hasTestBulletins) && !dismissing,
    ...BULLETIN_ANIMATION,
  })

  if (loading) return null

  if (hasBulletins || hasTestBulletins) {
    return (
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        {bulletins?.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges.map(
          ({ node: bulletin }) => {
            /** A bulletin the server marks as not dismissible stays until the server
             *  retires it: it gets no close control, and opening its link does not
             *  acknowledge it, so it is still on the home when the user comes back. */
            const dismiss = bulletin.dismissible
              ? () => dismissWithAnimation(bulletin.id)
              : undefined
            const link = linkOf(bulletin.action)
            /** With nothing to open and nothing to acknowledge, the card is inert rather
             *  than a button that does nothing. */
            const hasSomethingToDo = link !== null || bulletin.dismissible
            const openBulletin = async () => {
              if (link) Linking.openURL(link)
              if (dismiss) await dismiss()
            }
            const pressAction = hasSomethingToDo ? openBulletin : undefined

            return (
              <NotificationCardUI
                icon={
                  bulletin.icon
                    ? (bulletin.icon.toLowerCase().replace(/_/g, "-") as IconNamesType)
                    : undefined
                }
                key={bulletin.id}
                title={bulletin.title}
                text={bulletin.body}
                action={pressAction}
                dismissAction={dismiss}
                loading={ackLoading}
                buttonLabel={bulletin.action?.label ?? undefined}
              />
            )
          },
        )}
        {hasTestBulletins &&
          testBulletins.map((bulletin) => (
            <NotificationCardUI
              key={bulletin.id}
              title={bulletin.title}
              text={bulletin.body}
              icon={bulletin.icon}
              action={async () => {
                if (bulletin.type === "deep-link")
                  Linking.openURL(BLINK_DEEP_LINK_PREFIX + bulletin.deepLink)
                if (bulletin.type === "external-link") Linking.openURL(bulletin.url)
                testBulletinsStore.remove(bulletin.id)
              }}
              dismissAction={() => testBulletinsStore.remove(bulletin.id)}
            />
          ))}
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
