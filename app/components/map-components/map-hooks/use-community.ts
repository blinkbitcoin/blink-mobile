import { useEffect, useState } from "react"
import axios, { AxiosHeaders } from "axios"

import type { Area, AreaDataRpc } from "../map-types"
import { BTCMAP_RPC_URL } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react.tsx"

export const useArea = (id: number | null) => {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState<boolean>(false)
  const [community, setCommunity] = useState<Area | null>(null)

  const { LL } = useI18nContext()

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        if (!id) {
          setCommunity(null)
          return
        }
        const { data } = await axios.get<Area>(`https://api.btcmap.org/v3/areas/${id}`)

        if (!cancelled) {
          setCommunity(data)
        }
      } catch (e) {
        if (!cancelled) {
          setError(LL.MapScreen.btcmapErrors.communityData())
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    fetchData()

    return () => {
      cancelled = true
    }
  }, [id])

  return { community, isLoading, error }
}

export const useCommunityRpc = (id: string | null) => {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState<boolean>(false)
  const [community, setCommunity] = useState<AreaDataRpc | null>(null)

  const { LL } = useI18nContext()

  useEffect(() => {
    try {
      if (!id) {
        setCommunity(null)
        return
      }
      const request = JSON.stringify({
        jsonrpc: "2.0",
        method: "get_area",
        params: {
          // eslint-disable-next-line camelcase
          area_id: JSON.parse(id),
        },
        id: 1,
      })

      const headers = new AxiosHeaders()
      headers.set("Content-Type", "application/json")

      setLoading(true)
      ;(async () => {
        const { data } = await axios.post<AreaDataRpc>(BTCMAP_RPC_URL, request, {
          headers,
        })
        setCommunity(data)
      })()
    } catch (e) {
      setError(LL.MapScreen.btcmapErrors.communityData())
    } finally {
      setLoading(false)
    }
  }, [id])

  return { community, isLoading, error }
}
