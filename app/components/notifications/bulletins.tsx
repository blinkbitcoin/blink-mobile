import React from "react"
import { Linking } from "react-native"
import { useApolloClient } from "@apollo/client"

import { useNotifications } from "."
import { NotificationCardUI } from "./notification-card-ui"
import { testBulletinsStore, useTestBulletins } from "./test-bulletins-store"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import {
  BulletinsDocument,
  BulletinsQuery,
  useStatefulNotificationAcknowledgeMutation,
} from "@app/graphql/generated"
import { BLINK_DEEP_LINK_PREFIX } from "@app/config"
import { IconNamesType } from "../atomic/galoy-icon"
import { CarouselItem } from "./bulletin-carousel"
import { Bulletin, selectCarouselBulletins } from "./select-carousel-bulletins"

type Props = {
  loading: boolean
  bulletins: BulletinsQuery | undefined
}

/** The address a bulletin's action opens, or null when it has none. */
const linkOf = (action: Bulletin["action"]): string | null => {
  if (action?.__typename === "OpenDeepLinkAction") {
    return BLINK_DEEP_LINK_PREFIX + action.deepLink
  }
  if (action?.__typename === "OpenExternalLinkAction") return action.url
  return null
}

/**
 * The server bulletins as carousel cards, newest first, followed in development by the
 * test bulletins. With no server bulletin, the card queued through `notifyCard`, if any,
 * takes their place, as before the carousel.
 */
export const useServerBulletinItems = ({ loading, bulletins }: Props): CarouselItem[] => {
  const { cardInfo } = useNotifications()
  const client = useApolloClient()
  const testBulletins = useTestBulletins()
  const { persistentBulletinsEnabled, bulletinsShownSince } = useRemoteConfig()

  const [ack] = useStatefulNotificationAcknowledgeMutation()
  /** The bulletin whose acknowledgement is in flight: its card alone shows the spinner. */
  const [acknowledgingId, setAcknowledgingId] = React.useState<string | null>(null)

  /** Acknowledges a bulletin, then refetches, which takes its card out of the carousel. */
  const dismiss = React.useCallback(
    async (notificationId: string) => {
      setAcknowledgingId(notificationId)
      try {
        await ack({ variables: { input: { notificationId } } })
        await client.refetchQueries({ include: [BulletinsDocument] })
      } catch (e) {
        console.error("Failed to acknowledge notification", e)
      } finally {
        setAcknowledgingId(null)
      }
    },
    [ack, client],
  )

  if (loading) return []

  const shownBulletins = selectCarouselBulletins({
    bulletins: (
      bulletins?.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges ?? []
    ).map(({ node }) => node),
    isPersistenceOn: persistentBulletinsEnabled,
    shownSince: bulletinsShownSince,
  })

  const serverItems = shownBulletins.map(({ bulletin, canClose }): CarouselItem => {
    /**
     * A bulletin the server marks as not dismissible stays until the server retires it:
     * it gets no close control, and opening its link does not acknowledge it either.
     * Only the X or opening the link closes a bulletin, so a card without a link is not
     * a button.
     */
    const close = canClose ? () => dismiss(bulletin.id) : undefined
    const link = linkOf(bulletin.action)
    const openBulletin = link
      ? async () => {
          Linking.openURL(link)
          if (close) await close()
        }
      : undefined

    return {
      key: `server-${bulletin.id}`,
      node: (
        <NotificationCardUI
          icon={
            bulletin.icon
              ? (bulletin.icon.toLowerCase().replace(/_/g, "-") as IconNamesType)
              : undefined
          }
          title={bulletin.title}
          text={bulletin.body}
          action={openBulletin}
          dismissAction={close}
          loading={acknowledgingId === bulletin.id}
          buttonLabel={bulletin.action?.label ?? undefined}
        />
      ),
    }
  })

  const testItems = __DEV__
    ? testBulletins.map(
        (bulletin): CarouselItem => ({
          key: `test-${bulletin.id}`,
          node: (
            <NotificationCardUI
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
          ),
        }),
      )
    : []

  const items = [...serverItems, ...testItems]
  if (items.length > 0 || !cardInfo) return items

  return [
    {
      key: "notify-card",
      node: (
        <NotificationCardUI
          title={cardInfo.title}
          text={cardInfo.text}
          icon={cardInfo.icon}
          action={cardInfo.action}
          loading={cardInfo.loading}
          dismissAction={cardInfo.dismissAction}
        />
      ),
    },
  ]
}
