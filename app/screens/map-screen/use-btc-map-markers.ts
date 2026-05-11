import * as React from "react"
import { Region } from "react-native-maps"

import { BtcMapMarker, fetchBtcMapMarkers } from "./btc-map"

type BtcMapMarkersState = {
  markers: BtcMapMarker[]
  error?: Error
  loading: boolean
}

export const useBtcMapMarkers = (region?: Region): BtcMapMarkersState => {
  const [state, setState] = React.useState<BtcMapMarkersState>({
    markers: [],
    loading: false,
  })

  React.useEffect(() => {
    if (!region) {
      return
    }

    let active = true
    setState((current) => ({ ...current, error: undefined, loading: true }))

    fetchBtcMapMarkers(region)
      .then((markers) => {
        if (!active) {
          return
        }
        setState({ markers, loading: false })
      })
      .catch((error) => {
        if (!active) {
          return
        }
        setState({
          markers: [],
          loading: false,
          error:
            error instanceof Error ? error : new Error("Unable to load BTC Map places"),
        })
      })

    return () => {
      active = false
    }
  }, [region])

  return state
}
