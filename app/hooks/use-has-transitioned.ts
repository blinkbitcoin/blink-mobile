import { useEffect, useState } from "react"
import { ParamListBase, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

export const useHasTransitioned = (): boolean => {
  const navigation = useNavigation<StackNavigationProp<ParamListBase>>()
  const [hasTransitioned, setHasTransitioned] = useState(false)

  useEffect(() => {
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (!event.data.closing) setHasTransitioned(true)
    })
    return unsubscribe
  }, [navigation])

  return hasTransitioned
}
