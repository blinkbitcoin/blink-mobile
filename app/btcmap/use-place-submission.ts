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
 * `submitted` means BTC Map took the place. When it did not, `refused` says
 * which kind of failure it was: the backend answered and turned the place down
 * — a rate limit, a level too low, a duplicate — or the request never got an
 * answer at all. The advice for each is different, the first being about the
 * place and the second about the connection.
 *
 * The backend's own wording is deliberately not carried: it is English, and it
 * would be shown to whoever submitted the place in whatever language they read
 * the app in.
 */
type SubmitPlaceOutcome = { submitted: true } | { submitted: false; refused: boolean }

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
      // An answer with neither errors nor a place is not a refusal — there is
      // nothing to have refused it over — so it counts as an answer that never
      // arrived, which is what it amounts to.
      return { submitted: false, refused: Boolean(payload?.errors.length) }
    } catch {
      return { submitted: false, refused: false }
    }
  }

  return { submitPlace }
}
