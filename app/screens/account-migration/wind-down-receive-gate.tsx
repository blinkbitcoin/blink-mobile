import * as React from "react"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useWindDownReceiveBlocked } from "./hooks/use-wind-down-receive-blocked"

type WindDownReceiveGateProps = {
  children: React.ReactNode
}

/** Route-level guard: once the wind-down blocks receiving, every path into the
 *  receive screen (home button, modal, deeplink) bounces straight back home. */
export const WindDownReceiveGate: React.FC<WindDownReceiveGateProps> = ({ children }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const isReceiveBlocked = useWindDownReceiveBlocked()

  React.useEffect(() => {
    if (!isReceiveBlocked) return

    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }
    navigation.replace("Primary")
  }, [isReceiveBlocked, navigation])

  if (isReceiveBlocked) return null

  return <>{children}</>
}
