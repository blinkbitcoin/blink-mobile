import { useEffect, useState } from "react"
import axios from "axios"

import { BTCMAP_V4_API_BASE } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react.tsx"

export const usePlace = (id?: number | null) => {
  const [error, setError] = useState<string | null>(null)
  const [placeData, setPlaceData] = useState<{
    id: string
    name: string
    phone: string
    website: string
    address: string
  } | null>(null)
  const [isLoading, setLoading] = useState<boolean>(false)

  const { LL } = useI18nContext()

  useEffect(() => {
    setError(null)
    setPlaceData(null)

    if (!id) {
      setLoading(false)
      return
    }

    const fetchPlace = async () => {
      setLoading(true)

      try {
        const { data } = await axios.get<{
          id: string
          name: string
          phone: string
          website: string
          address: string
        }>(`${BTCMAP_V4_API_BASE}/places/${id}?fields=id,name,phone,website,address`)
        setPlaceData(data)
      } catch (error) {
        setError(LL.MapScreen.btcmapErrors.placeData())
      } finally {
        setLoading(false)
      }
    }

    fetchPlace()
  }, [id])

  return { placeData, error, isLoading }
}
