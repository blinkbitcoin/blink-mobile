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

type ServerBulletinItems = {
  items: CarouselItem[]
  /** The home carousel's key. It changes once, when the carousel opened with no server
   *  bulletin and the first settled response brings some, so the carousel remounts on
   *  the newest of them instead of keeping the app card it opened on in view. Later
   *  refetches keep it, and with it the card the user is reading. */
  carouselKey: string
}

/**
 * The server bulletins as carousel cards, newest first, followed in development by the
 * test bulletins. With no server bulletin, the card queued through `notifyCard`, if any,
 * takes their place, as before the carousel. Cached bulletins stay in while a request is
 * in flight: `loading` gates nothing on screen, it only tells when the first response
 * has settled.
 */
export const useServerBulletinItems = ({
  loading,
  bulletins,
}: Props): ServerBulletinItems => {
  const { cardInfo } = useNotifications()
  const client = useApolloClient()
  const testBulletins = useTestBulletins()
  const { persistentBulletinsEnabled, bulletinsShownSince } = useRemoteConfig()

  const [ack] = useStatefulNotificationAcknowledgeMutation()
  /** The bulletins whose acknowledgement is in flight: their cards alone show the
   *  spinner. Several can be in flight at once, since the carousel stays swipeable. The
   *  ref is the guard against a second close, as it is current before the next render. */
  const [acknowledgingIds, setAcknowledgingIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const acknowledging = React.useRef(new Set<string>())

  /** Acknowledges a bulletin, then refetches, which takes its card out of the carousel. */
  const dismiss = React.useCallback(
    async (notificationId: string) => {
      if (acknowledging.current.has(notificationId)) return
      acknowledging.current.add(notificationId)
      setAcknowledgingIds(new Set(acknowledging.current))
      try {
        await ack({ variables: { input: { notificationId } } })
        await client.refetchQueries({ include: [BulletinsDocument] })
      } catch (e) {
        console.error("Failed to acknowledge notification", e)
      } finally {
        acknowledging.current.delete(notificationId)
        setAcknowledgingIds(new Set(acknowledging.current))
      }
    },
    [ack, client],
  )

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
          loading={acknowledgingIds.has(bulletin.id)}
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

  const carouselKey = useCarouselKey({
    settled: !loading && bulletins !== undefined,
    hasServerItems: serverItems.length > 0,
  })

  const items = [...serverItems, ...testItems]
  if (items.length > 0 || !cardInfo) return { items, carouselKey }

  return {
    items: [
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
    ],
    carouselKey,
  }
}

/** Decided on the first settled response, from what the carousel opened with. */
const useCarouselKey = ({
  settled,
  hasServerItems,
}: {
  settled: boolean
  hasServerItems: boolean
}): string => {
  const [openedWithServerItems] = React.useState(hasServerItems)
  const [remount, setRemount] = React.useState<boolean | null>(null)
  if (remount === null && settled) setRemount(!openedWithServerItems && hasServerItems)
  return remount ? "settled" : "opened"
}
