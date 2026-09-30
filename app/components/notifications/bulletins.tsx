import React from "react"
import { Animated, Linking } from "react-native"
import { useApolloClient } from "@apollo/client"

import { useNotifications } from "."
import { NotificationCardUI } from "./notification-card-ui"
import { testBulletinsStore, useTestBulletins } from "./test-bulletins-store"
import { useDropInOutAnimation } from "@app/components/animations"
import { useRemoteConfig } from "@app/config/feature-flags-context"
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

/**
 * The bulletins the home shows out of the page the server sent: the newest one the user
 * cannot close, if any, on top, where it stays however many closable ones arrive after
 * it, and under it the newest one they can close. Closable ones do not stack. With
 * persistent bulletins switched off every bulletin reads as closable, so only the newest
 * one shows, as it always did.
 */
const selectShownBulletins = (
  bulletins: readonly Bulletin[],
  isPersistenceOn: boolean,
): { bulletin: Bulletin; canClose: boolean }[] => {
  const canClose = (bulletin: Bulletin): boolean =>
    !isPersistenceOn || bulletin.dismissible
  const newestKept = bulletins.find((bulletin) => !canClose(bulletin))
  const newestClosable = bulletins.find(canClose)
  return [newestKept, newestClosable]
    .filter((bulletin): bulletin is Bulletin => bulletin !== undefined)
    .map((bulletin) => ({ bulletin, canClose: canClose(bulletin) }))
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
  const { persistentBulletinsEnabled } = useRemoteConfig()

  const [ack] = useStatefulNotificationAcknowledgeMutation()
  /** The bulletin whose acknowledgement is in flight: its card alone shows the spinner,
   *  so closing one does not blank the others. */
  const [acknowledgingId, setAcknowledgingId] = React.useState<string | null>(null)

  /**
   * Acknowledges a bulletin and takes it off the home. The list animates out only when
   * the card closed was the last one it shows; with another card staying, the list stays
   * up and is refetched at once, so the card that stays does not leave and come back.
   */
  const dismissWithAnimation = React.useCallback(
    async (notificationId: string, isLastShown: boolean) => {
      setAcknowledgingId(notificationId)
      try {
        await ack({ variables: { input: { notificationId } } })
      } catch (e) {
        console.error("Failed to acknowledge notification", e)
        return
      } finally {
        setAcknowledgingId(null)
      }
      if (!isLastShown) {
        client.refetchQueries({ include: [BulletinsDocument] })
        return
      }
      setDismissing(true)
      setTimeout(() => {
        client.refetchQueries({ include: [BulletinsDocument] })
        setDismissing(false)
      }, BULLETIN_ANIMATION.durationOut)
    },
    [ack, client],
  )

  const shownBulletins = selectShownBulletins(
    (
      bulletins?.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges ?? []
    ).map(({ node }) => node),
    persistentBulletinsEnabled,
  )
  const hasBulletins = !loading && shownBulletins.length > 0

  const hasTestBulletins = __DEV__ && testBulletins.length > 0

  const { opacity, translateY } = useDropInOutAnimation({
    visible: (Boolean(hasBulletins) || hasTestBulletins) && !dismissing,
    ...BULLETIN_ANIMATION,
  })

  if (loading) return null

  if (hasBulletins || hasTestBulletins) {
    return (
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        {shownBulletins.map(({ bulletin, canClose }) => {
          /**
           * A bulletin the server marks as not dismissible stays until the server retires
           * it: it gets no close control, and opening its link does not acknowledge it
           * either. The server would take the acknowledgement, which is what keeps older
           * apps working, but this app withholds it on purpose: such a bulletin is retired
           * once what it asks for is done, not when it is opened.
           */
          const isLastShown = shownBulletins.length === 1
          const dismiss = canClose
            ? () => dismissWithAnimation(bulletin.id, isLastShown)
            : undefined
          const link = linkOf(bulletin.action)
          /** With nothing to open and nothing to acknowledge, the card is inert rather
           *  than a button that does nothing. */
          const hasSomethingToDo = link !== null || canClose
          const openBulletin = async () => {
            if (link) Linking.openURL(link)
            if (dismiss) await dismiss()
          }
          const pressAction = hasSomethingToDo ? openBulletin : undefined
          const isAcknowledging = acknowledgingId === bulletin.id

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
              loading={isAcknowledging}
              buttonLabel={bulletin.action?.label ?? undefined}
            />
          )
        })}
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
