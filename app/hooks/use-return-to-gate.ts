import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

/**
 * Sends the app back to the gate with the lock raised.
 *
 * For whatever ends a session without the lock having been answered: a spent PIN
 * budget, the lock screen's own logout, a token the backend no longer accepts. A
 * logout keeps the lock for as long as the device still stores something it
 * guards, so the landing screen is not where any of them may land: it can open a
 * new account, and any account lists every wallet the device stores. The gate
 * asks again, and it is the gate that hands a device with nothing left to unlock
 * to the landing screen.
 *
 * The flag goes up with it. This can run in a session that was unlocked, and a
 * gate shown with the flag down lets a payment link open over the lock screen
 * and the resume relock stack a second lock on top of it.
 *
 * Reset, not replace: this can be asked from a screen pushed on top of the live
 * stack, and anything left beneath would still be reachable.
 */
export const useReturnToGate = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { setAppLocked } = useAuthenticationContext()

  return useCallback(() => {
    setAppLocked()
    navigation.reset({ index: 0, routes: [{ name: "authenticationCheck" }] })
  }, [navigation, setAppLocked])
}
