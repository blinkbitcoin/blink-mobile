/**
 * The server's invitation bulletin, and the moment the app retires it.
 *
 * The invitation is sent as a bulletin the investor cannot close, so it stays on the home
 * however many times the flow is opened and left. Signing the agreement is what answers
 * it, and the server has no way of knowing that happened, so the app acknowledges the
 * bulletin itself at that moment and writes down which one it answered. The bulletin is
 * found by its key rather than by position, since other bulletins may sit in front of it.
 *
 * A new invitation is only ever sent once the previous one is acknowledged, so an
 * investment bulletin other than the one written down is a fresh invitation: it is left
 * standing for the investor to see, and the investment it supersedes is forgotten.
 */

import { useCallback, useEffect } from "react"
import { ApolloClient, ApolloQueryResult, gql, useApolloClient } from "@apollo/client"

import {
  BulletinsDocument,
  BulletinsQuery,
  UnacknowledgedBulletinKeysDocument,
  UnacknowledgedBulletinKeysQuery,
  UnacknowledgedBulletinKeysQueryVariables,
  useStatefulNotificationAcknowledgeMutation,
} from "@app/graphql/generated"
import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"
import { CardInvestmentProgress } from "@app/types/card-investment"
import { logError } from "@app/utils/log-error"

gql`
  query UnacknowledgedBulletinKeys($first: Int!, $after: String) {
    me {
      id
      unacknowledgedStatefulNotificationsWithBulletinEnabled(
        first: $first
        after: $after
      ) {
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            id
            bulletinKey
            createdAt
          }
        }
      }
    }
  }
`

/** The key the invitation panel sends the investment invitation under. */
export const INVESTMENT_INVITATION_BULLETIN_KEY = "investment-invitation"

/** Unacknowledged bulletins are few; one page is the usual whole of them. The cap is
 *  there so a cursor that never advances cannot keep the lookup asking for ever. */
const BULLETIN_PAGE_SIZE = 20
const BULLETIN_PAGE_LIMIT = 10

/** The server stamps bulletins in whole seconds; the record's moments are milliseconds. */
const MS_PER_SECOND = 1000

const LOG_SCOPE = "card-investment-invitation"

export type InvitationBulletin = {
  id: string
  /** When the server created it, in seconds. */
  createdAt: number
}

/**
 * The investor's unacknowledged invitation bulletin, or null when there is none. Read
 * from the server rather than the cache, since the answer decides a mutation. At most
 * one bulletin is active per key, so the first match is the one.
 */
export const findInvestmentInvitationBulletin = async (
  client: ApolloClient<object>,
): Promise<InvitationBulletin | null> => {
  let after: string | null = null
  let pagesRead = 0
  do {
    const answer: ApolloQueryResult<UnacknowledgedBulletinKeysQuery> = await client.query<
      UnacknowledgedBulletinKeysQuery,
      UnacknowledgedBulletinKeysQueryVariables
    >({
      query: UnacknowledgedBulletinKeysDocument,
      variables: { first: BULLETIN_PAGE_SIZE, after },
      fetchPolicy: "network-only",
    })
    const bulletins =
      answer.data.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled
    if (!bulletins) return null

    const invitation = bulletins.edges.find(
      ({ node }) => node.bulletinKey === INVESTMENT_INVITATION_BULLETIN_KEY,
    )
    if (invitation) {
      return { id: invitation.node.id, createdAt: invitation.node.createdAt }
    }

    pagesRead += 1
    after = bulletins.pageInfo.hasNextPage ? bulletins.pageInfo.endCursor ?? null : null
  } while (after && pagesRead < BULLETIN_PAGE_LIMIT)

  return null
}

/** What the home's fallback reads off the signed record to tell the answered invitation
 *  from a new one. */
type SignedInvitationRecord = Pick<
  CardInvestmentProgress,
  "signedAt" | "invitationBulletinId"
>

/**
 * Whether a bulletin is the invitation the signature answered. The signing step writes
 * down the one it found, and that id is the whole test. When it wrote none down, because
 * it could not reach the server at the time, the bulletin's age stands in: the answered
 * invitation was created before the signature, and a new one can only be sent after the
 * old is acknowledged, so it is newer.
 */
export const isAnsweredInvitation = (
  invitation: InvitationBulletin,
  record: SignedInvitationRecord,
): boolean => {
  if (record.invitationBulletinId !== undefined) {
    return invitation.id === record.invitationBulletinId
  }
  return invitation.createdAt * MS_PER_SECOND < record.signedAt
}

/**
 * One settlement in flight at a time. The signing step and the home both ask at the
 * moment of signature, and the second would only acknowledge the same bulletin again or
 * find it gone, so the home joins whatever is in flight: its question is the same one.
 * The signing step waits its turn instead: it has something to write down, and a lookup
 * the home started moments earlier, on the record as it was before the signature, cannot
 * do that for it.
 */
let pendingSettlement: Promise<void> | null = null

const trackSettlement = (settlement: Promise<void>): Promise<void> => {
  const tracked: Promise<void> = settlement.finally(() => {
    if (pendingSettlement === tracked) pendingSettlement = null
  })
  pendingSettlement = tracked
  return tracked
}

const joinPendingSettlement = (settle: () => Promise<void>): Promise<void> =>
  pendingSettlement ?? trackSettlement(settle())

const queueSettlement = (settle: () => Promise<void>): Promise<void> =>
  trackSettlement(pendingSettlement ? pendingSettlement.then(settle) : settle())

/** Acknowledges a bulletin and refetches the home's list, so the card leaves without
 *  waiting for the next refresh. */
const useRetireBulletin = (): ((notificationId: string) => Promise<void>) => {
  const client = useApolloClient()
  const [acknowledge] = useStatefulNotificationAcknowledgeMutation()

  return useCallback(
    async (notificationId: string) => {
      await acknowledge({ variables: { input: { notificationId } } })
      await client.refetchQueries({ include: [BulletinsDocument] })
    },
    [acknowledge, client],
  )
}

/**
 * For the signing step: writes down the invitation bulletin that is up, then acknowledges
 * it. Written down first, so that a record exists to tell it apart from a later
 * invitation even if the acknowledgement itself fails. Quiet on failure: the signature
 * and the payment do not depend on it, and a bulletin left standing is the worst a failed
 * attempt leaves behind; the home's fallback picks it up.
 */
export const useAcknowledgeInvestmentInvitation = (): (() => Promise<void>) => {
  const client = useApolloClient()
  const retireBulletin = useRetireBulletin()
  const { recordInvitationBulletin } = useCardInvestmentProgress()

  return useCallback(
    () =>
      queueSettlement(async () => {
        try {
          const invitation = await findInvestmentInvitationBulletin(client)
          if (!invitation) return
          recordInvitationBulletin(invitation.id)
          await retireBulletin(invitation.id)
        } catch (error) {
          logError({ scope: LOG_SCOPE, error, expected: true })
        }
      }),
    [client, retireBulletin, recordInvitationBulletin],
  )
}

/**
 * The home's fallback for an invitation the signing step did not manage to retire: an
 * app killed as the signature landed, or offline at that moment. Whenever the home holds
 * a signed investment and the server still shows bulletins, the investment bulletin is
 * looked for among them. The answered one is acknowledged. Any other is a new invitation:
 * it is left for the investor to see, and the signed investment it supersedes is
 * forgotten, so the flow can be walked again for it. A bulletin that is neither known to
 * be answered nor known to be new, one newer than a signature that wrote no id down, is
 * left alone and logged: acknowledging it would hide an invitation, forgetting the
 * investment would lose a payment in progress.
 *
 * Keyed on the list the home was served, so a refresh, a push or a returned connection
 * that brings a new list looks again, while renders that bring the same list do not.
 */
export const useAcknowledgeInvitationOnceSigned = (
  bulletins: BulletinsQuery | undefined,
): void => {
  const client = useApolloClient()
  const retireBulletin = useRetireBulletin()
  const { progress, clear: forgetInvestment } = useCardInvestmentProgress()

  /** The two fields the decision reads, taken apart so the effect runs on their change
   *  and not on every other write to the record. */
  const signedAt = progress?.signedAt
  const invitationBulletinId = progress?.invitationBulletinId
  const shownBulletins =
    bulletins?.me?.unacknowledgedStatefulNotificationsWithBulletinEnabled?.edges.length ??
    0
  const hasBulletins = shownBulletins > 0

  useEffect(() => {
    if (signedAt === undefined || !hasBulletins) return

    joinPendingSettlement(async () => {
      try {
        const invitation = await findInvestmentInvitationBulletin(client)
        if (!invitation) return
        if (isAnsweredInvitation(invitation, { signedAt, invitationBulletinId })) {
          await retireBulletin(invitation.id)
          return
        }
        if (invitationBulletinId !== undefined) {
          /** Only the investment this decision was made on: one signed while the lookup
           *  was out is answering this very invitation. */
          forgetInvestment({ onlyIfSignedAt: signedAt })
          return
        }
        logError({
          scope: LOG_SCOPE,
          error: new Error(
            "an investment bulletin newer than the signature, none recorded",
          ),
          context: { bulletinId: invitation.id },
          expected: true,
        })
      } catch (error) {
        logError({ scope: LOG_SCOPE, error, expected: true })
      }
    })
  }, [
    signedAt,
    invitationBulletinId,
    hasBulletins,
    bulletins,
    client,
    retireBulletin,
    forgetInvestment,
  ])
}
