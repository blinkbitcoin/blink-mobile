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
      }
    }
  }
`

/**
 * `submitted` means BTC Map took the place. When it did not, `message` is the
 * backend's own reason for refusing — a rate limit, a level too low, a
 * duplicate — and null when the request never got an answer at all, since the
 * advice for each is different: the first is the place, the second the
 * connection.
 */
type SubmitPlaceOutcome =
  | { submitted: true }
  | { submitted: false; message: string | null }

type SubmitPlace = (
  submission: PlaceSubmission,
  submissionId: string,
) => Promise<SubmitPlaceOutcome>

/**
 * Sends a place to BTC Map through the Blink backend, which proxies it.
 *
 * `submissionId` is the operation's identity: the backend deduplicates on it,
 * so the caller mints one per attempt at adding a place and reuses it for every
 * retry of that attempt — a resent request updates the original submission
 * rather than drawing the shop onto the map twice.
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
      if (payload && payload.errors.length === 0 && payload.place) {
        return { submitted: true }
      }
      return { submitted: false, message: payload?.errors[0]?.message ?? null }
    } catch {
      return { submitted: false, message: null }
    }
  }

  return { submitPlace }
}
