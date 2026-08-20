import { useCallback, useEffect, useRef, useState } from "react"

import { recordAppError, toError } from "@app/utils/error-reporting"

import { fetchPlaceDetails } from "./api"
import { BtcMapPlaceDetails } from "./types"

type State = {
  // The place this state describes, so a consumer can tell whether what it is
  // holding belongs to the place it is currently drawing.
  id?: number
  details: BtcMapPlaceDetails | null
  isLoading: boolean
  hasError: boolean
}

const IDLE: State = { id: undefined, details: null, isLoading: false, hasError: false }

/**
 * Everything about one place beyond its pin.
 *
 * The offline snapshot deliberately holds only coordinates and an icon, so the
 * name, hours and contact details are fetched when a place is actually opened.
 * BTC Map has no batch endpoint, which makes on-demand the only option anyway.
 */
export const useBtcMapPlaceDetails = (id?: number) => {
  const [state, setState] = useState<State>(IDLE)
  const [attempt, setAttempt] = useState(0)

  // Identifies the request, not the place: tapping A then B then A again leaves
  // two live requests for A, and only the newest of them may write state.
  const requestRef = useRef(0)

  useEffect(() => {
    requestRef.current += 1
    const request = requestRef.current

    if (!id) {
      setState(IDLE)
      return
    }

    // Set synchronously with the id change rather than in a later effect, so no
    // frame ever pairs one place's identity with another's details.
    setState({ id, details: null, isLoading: true, hasError: false })

    const load = async () => {
      try {
        const details = await fetchPlaceDetails(id)
        if (requestRef.current !== request) return
        setState({ id, details, isLoading: false, hasError: false })
      } catch (error) {
        recordAppError(toError(error), { dedupKey: "btcmap-place-details" })
        if (requestRef.current !== request) return
        setState({ id, details: null, isLoading: false, hasError: true })
      }
    }

    load()
  }, [id, attempt])

  const retry = useCallback(() => setAttempt((previous) => previous + 1), [])

  // A render can run before the effect that reacts to a new id, so anything the
  // previous place loaded is withheld until the state catches up.
  const isCurrent = state.id === id
  return {
    details: isCurrent ? state.details : null,
    isLoading: isCurrent ? state.isLoading : Boolean(id),
    hasError: isCurrent ? state.hasError : false,
    retry,
  }
}
