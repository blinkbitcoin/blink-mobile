import * as React from "react"
import { gql } from "@apollo/client"

import { ApplicationStatus, useCardApplicationStatusQuery } from "@app/graphql/generated"

gql`
  query cardApplicationStatus {
    me {
      id
      defaultAccount {
        id
        ... on ConsumerAccount {
          cardConsumerApplications {
            id
            applicationStatus
          }
        }
      }
    }
  }
`

/** As long as the processing screen promises to wait. */
export const APPROVAL_WAIT_MS = 60_000
export const APPROVAL_POLL_INTERVAL_MS = 5_000

/** Answers the issuer gives once and keeps: nothing more is coming within the wait. */
const REFUSED_STATUSES: ReadonlyArray<ApplicationStatus> = [
  ApplicationStatus.Denied,
  ApplicationStatus.Canceled,
  ApplicationStatus.Locked,
]

export type CardApprovalWait = "waiting" | "approved" | "declined" | "timedOut"

export const isCardApplicationRefused = (
  status: ApplicationStatus | undefined,
): boolean => REFUSED_STATUSES.some((refused) => refused === status)

/** Follows the sent application for up to a minute. An answer from the issuer ends the
 *  wait at once; an issuer still reviewing when the minute is up leaves the answer to
 *  the home and a bulletin. */
export const useCardApplicationApproval = (applicationId: string): CardApprovalWait => {
  const [hasTimedOut, setHasTimedOut] = React.useState(false)

  React.useEffect(() => {
    const timeout = setTimeout(() => setHasTimedOut(true), APPROVAL_WAIT_MS)
    return () => clearTimeout(timeout)
  }, [])

  const { data } = useCardApplicationStatusQuery({
    fetchPolicy: "network-only",
    pollInterval: APPROVAL_POLL_INTERVAL_MS,
    skip: hasTimedOut,
  })

  const status = data?.me?.defaultAccount?.cardConsumerApplications?.find(
    (application) => application.id === applicationId,
  )?.applicationStatus

  if (status === ApplicationStatus.Approved) return "approved"
  if (isCardApplicationRefused(status)) return "declined"
  if (hasTimedOut) return "timedOut"
  return "waiting"
}
