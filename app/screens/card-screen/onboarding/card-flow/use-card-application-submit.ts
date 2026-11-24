import * as React from "react"
import { gql } from "@apollo/client"

import {
  ApplicationStatus,
  useCardApplicationStatusLazyQuery,
  useCardConsumerApplicationCreateMutation,
  useCardKycStatusLazyQuery,
} from "@app/graphql/generated"
import { CardApplicationAnswers } from "@app/types/card-application"
import { logError } from "@app/utils/log-error"

import { isCardApplicationRefused } from "./use-card-application-approval"
import { isCardKycApproved } from "./use-card-kyc-status"

gql`
  mutation cardConsumerApplicationCreate($input: CardConsumerApplicationCreateInput!) {
    cardConsumerApplicationCreate(input: $input) {
      id
      applicationStatus
    }
  }
`

/** The refusals the issuer keeps on the account: blink-card takes no other application
 *  after them. A cancellation is not one, since blink-card lets the user apply again. */
const BLOCKING_REFUSALS: ReadonlyArray<ApplicationStatus> = [
  ApplicationStatus.Denied,
  ApplicationStatus.Locked,
]

const isBlockingRefusal = (status: ApplicationStatus): boolean =>
  BLOCKING_REFUSALS.some((refusal) => refusal === status)

/** Only the error is recorded, never the answers: they are the user's personal details. */
const CREATE_FAILED_SCOPE = "card-application-create"
const READ_BACK_FAILED_SCOPE = "card-application-read-back"

/** Sends the card application with the terms accepted, and answers the id of the
 *  application to wait for, or null when there is none. */
export const useCardApplicationSubmit = () => {
  const [createApplication] = useCardConsumerApplicationCreateMutation()
  const [readKycStatus] = useCardKycStatusLazyQuery({ fetchPolicy: "network-only" })
  const [readApplications] = useCardApplicationStatusLazyQuery({
    fetchPolicy: "network-only",
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const submitApplication = React.useCallback(
    async (answers: CardApplicationAnswers): Promise<string | null> => {
      setIsSubmitting(true)
      try {
        /** An approved verification goes to the issuer at once. Any other answer, a failed
         *  read included, has the backend hold the application until the verification
         *  is approved, which is the safe side to err on. */
        const { data: kycData } = await readKycStatus()
        const { data } = await createApplication({
          variables: {
            input: {
              ...answers,
              isL2Verified: isCardKycApproved(kycData?.me?.defaultAccount),
              isTermsOfServiceAccepted: true,
            },
          },
        })
        return data?.cardConsumerApplicationCreate.id ?? null
      } catch (createError) {
        logError({ scope: CREATE_FAILED_SCOPE, error: createError })
        /** A create whose answer was lost landed all the same, and the issuer refuses a
         *  second one, as it does for a user back here after the wait ran out. Either
         *  way the account's application is the one to follow: a live one is waited on,
         *  and a refusal the issuer keeps takes the wait straight to the decline. A
         *  cancelled one says nothing about this attempt, since the user may apply again
         *  after it, so the terms stay open to try again. */
        const { data: applicationsData, error: readBackError } = await readApplications()
        if (readBackError)
          logError({ scope: READ_BACK_FAILED_SCOPE, error: readBackError })
        const applications =
          applicationsData?.me?.defaultAccount?.cardConsumerApplications ?? []
        const liveApplication = applications.find(
          (application) => !isCardApplicationRefused(application.applicationStatus),
        )
        const blockingRefusal = applications.find((application) =>
          isBlockingRefusal(application.applicationStatus),
        )
        const followedApplication = liveApplication ?? blockingRefusal
        return followedApplication?.id ?? null
      } finally {
        setIsSubmitting(false)
      }
    },
    [createApplication, readApplications, readKycStatus],
  )

  return { submitApplication, isSubmitting }
}
