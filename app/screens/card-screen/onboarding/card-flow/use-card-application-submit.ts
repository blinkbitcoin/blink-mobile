import * as React from "react"
import { gql } from "@apollo/client"

import {
  useCardApplicationStatusLazyQuery,
  useCardConsumerApplicationCreateMutation,
  useCardKycStatusLazyQuery,
} from "@app/graphql/generated"
import { CardApplicationAnswers } from "@app/types/card-application"

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
      } catch {
        /** A create whose answer was lost landed all the same, and the issuer refuses a
         *  second one, as it does for a user back here after the wait ran out. Either
         *  way the account's application is the one to follow: a live one is waited on,
         *  and one the issuer already refused takes the wait straight to the decline. */
        const { data: applicationsData } = await readApplications()
        const applications =
          applicationsData?.me?.defaultAccount?.cardConsumerApplications ?? []
        const liveApplication = applications.find(
          (application) => !isCardApplicationRefused(application.applicationStatus),
        )
        const followedApplication = liveApplication ?? applications[0]
        return followedApplication?.id ?? null
      } finally {
        setIsSubmitting(false)
      }
    },
    [createApplication, readApplications, readKycStatus],
  )

  return { submitApplication, isSubmitting }
}
