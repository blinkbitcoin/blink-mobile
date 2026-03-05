import { useEffect, useState } from "react"

type UseCountdownReturn = {
  remainingSeconds: number | null
  isExpired: boolean
}

export const useCountdown = (expiresAt: Date | null): UseCountdownReturn => {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(null)
      return
    }

    const tick = () => {
      const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      if (remaining >= 0) {
        setRemainingSeconds(remaining)
      } else {
        setRemainingSeconds(0)
        clearInterval(intervalId)
      }
    }

    const intervalId = setInterval(tick, 1000)
    tick()

    return () => clearInterval(intervalId)
  }, [expiresAt])

  return {
    remainingSeconds,
    isExpired: remainingSeconds === 0,
  }
}
