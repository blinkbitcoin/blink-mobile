import { gql } from "@apollo/client"

import { useBtcMapPlaceSubmitMutation } from "@app/graphql/generated"

import { PlaceSubmission } from "./submission"

gql`
  mutation btcMapPlaceSubmit($input: BtcMapPlaceSubmitInput!) {
    btcMapPlaceSubmit(input: $input) {
      errors {
        message
      }
      place {
        id
        origin
        externalId
      }
    }
  }
`

export type SubmitPlace = (
  submission: PlaceSubmission,
  submissionId: string,
) => Promise<boolean>

/**
 * Sends a place to BTC Map through the Blink backend, which proxies it.
 *
 * `submissionId` is the operation's identity: the backend deduplicates on it,
 * so the caller mints one per attempt at adding a place and reuses it for every
 * retry of that attempt — a resent request updates the original submission
 * rather than drawing the shop onto the map twice.
 *
 * True means BTC Map took the place; false covers both a refused payload and a
 * request that never got an answer, since to the person filling in the form
 * both are "it did not go, try again".
 */
export const useSubmitBtcMapPlace = (): { submitPlace: SubmitPlace } => {
  const [btcMapPlaceSubmit] = useBtcMapPlaceSubmitMutation()

  const submitPlace: SubmitPlace = async (submission, submissionId) => {
    try {
      const { data } = await btcMapPlaceSubmit({
        variables: {
          input: {
            submissionId,
            name: submission.name,
            category: submission.category,
            latitude: submission.latitude,
            longitude: submission.longitude,
          },
        },
      })
      const payload = data?.btcMapPlaceSubmit
      return Boolean(payload && payload.errors.length === 0 && payload.place)
    } catch {
      return false
    }
  }

  return { submitPlace }
}
