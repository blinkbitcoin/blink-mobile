import { gql } from "@apollo/client"

import {
  CardKycStatusQuery,
  KycFlowType,
  OnboardingStatus,
  useCardKycStatusLazyQuery,
} from "@app/graphql/generated"

gql`
  query cardKycStatus {
    me {
      id
      defaultAccount {
        ... on ConsumerAccount {
          id
          onboardingStatus
          flowType
        }
      }
    }
  }
`

type KycAccount = NonNullable<CardKycStatusQuery["me"]>["defaultAccount"] | undefined

/** The issuer's review has the documents once it leaves AWAITING_INPUT: Sumsub reports
 *  a submitted applicant as processing, an applicant on hold as review, and a green
 *  answer as approved. */
const SUBMITTED_STATUSES: ReadonlyArray<OnboardingStatus> = [
  OnboardingStatus.Processing,
  OnboardingStatus.Review,
  OnboardingStatus.Approved,
]

/** The account's onboarding status follows its latest verification, which may be the
 *  level two upgrade rather than the card's, so only a card flow counts. */
const isCardFlow = (account: KycAccount) => account?.flowType === KycFlowType.Card

export const isCardKycSubmitted = (account: KycAccount): boolean =>
  isCardFlow(account) &&
  SUBMITTED_STATUSES.some((status) => status === account?.onboardingStatus)

export const isCardKycApproved = (account: KycAccount): boolean =>
  isCardFlow(account) && account?.onboardingStatus === OnboardingStatus.Approved

/** Reads the card verification afresh on each call, since it moves on the issuer's side
 *  while the app is away in the verification web flow. */
export const useCardKycStatus = () => {
  const [readKycStatus, { data, loading }] = useCardKycStatusLazyQuery({
    fetchPolicy: "network-only",
  })

  const account = data?.me?.defaultAccount

  return {
    readKycStatus,
    isKycSubmitted: isCardKycSubmitted(account),
    isCheckingKyc: loading,
  }
}
