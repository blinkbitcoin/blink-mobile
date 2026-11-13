import * as React from "react"
import { gql } from "@apollo/client"

import {
  useCardConsumerApplicationCreateMutation,
  useCardKycStatusLazyQuery,
} from "@app/graphql/generated"
import { CardApplicationAnswers } from "@app/types/card-application"

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
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [createApplication, readKycStatus],
  )

  return { submitApplication, isSubmitting }
}
