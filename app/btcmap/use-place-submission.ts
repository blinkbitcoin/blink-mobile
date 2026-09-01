import React from "react"

import { ApolloError, gql } from "@apollo/client"

import { useBtcMapPlaceSubmitMutation } from "@app/graphql/generated"
import { reportError } from "@app/utils/error-logging"

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

  const submitPlace: SubmitPlace = React.useCallback(
    async (submission, submissionId) => {
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
        // The refusal's own wording goes to Crashlytics rather than the user:
        // it only ever comes back in English, but it is the only way support
        // can tell a rate limit from a duplicate, which the form's single
        // sentence deliberately does not. An expected outcome, so a breadcrumb
        // rather than a non-fatal.
        if (payload?.errors.length) {
          reportError(
            "btcMapPlaceSubmit",
            new Error(
              `place refused: ${payload.errors.map(({ message }) => message).join("; ")}`,
            ),
            { expected: true },
          )
        }
        // An answer with neither errors nor a place is not a refusal — there is
        // nothing to have refused it over — so it counts as an answer that never
        // arrived, which is what it amounts to.
        return { submitted: false, refused: Boolean(payload?.errors.length) }
      } catch (error) {
        // Apollo rejects the promise on a top-level GraphQL error as well as on
        // a network failure, and the two are not the same failure: a GraphQL
        // error means the server answered and turned the request down, so
        // "check your connection" would send the user chasing a problem that
        // is not theirs — and retrying will never fix.
        if (error instanceof ApolloError && error.graphQLErrors.length > 0) {
          reportError("btcMapPlaceSubmit", error, { expected: true })
          return { submitted: false, refused: true }
        }
        // A connectivity failure downgrades itself to a breadcrumb inside
        // reportError; anything else is a defect worth a non-fatal.
        reportError("btcMapPlaceSubmit", error)
        return { submitted: false, refused: false }
      }
    },
    [btcMapPlaceSubmit],
  )

  return { submitPlace }
}
