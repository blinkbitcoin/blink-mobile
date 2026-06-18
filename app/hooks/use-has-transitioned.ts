import { useEffect, useState } from "react"
import { ParamListBase, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

export const useHasTransitioned = (): boolean => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
  const [hasTransitioned, setHasTransitioned] = useState(false)

  useEffect(() => {
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (!event.data.closing) setHasTransitioned(true)
    })
    return unsubscribe
  }, [navigation])

  return hasTransitioned
}
