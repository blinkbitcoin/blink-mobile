import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import { ActivityIndicator, View } from "react-native"

import { useNavigation, usePreventRemove } from "@react-navigation/native"

import {
  defaultHeaderBack,
  suppressedHeaderBack,
} from "@app/components/header-back-control/header-back-control"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

type AccountDeleteContextType = {
  /** `identifier` names the account on the lock screen: a removal switches the active
   *  account before it finishes, so anything read live would already name the next one. */
  setAccountIsBeingDeleted: (isBeingDeleted: boolean, identifier?: string) => void
  /** Runs the navigation that takes the user off this screen once a removal has landed,
   *  without dropping the lock first: the screen behind it already describes the next
   *  account, so lifting the cover for the transition would flash it. */
  leaveWhileDeleting: (navigate: () => void) => void
}

const AccountDeleteContext = createContext<AccountDeleteContextType>({
  setAccountIsBeingDeleted: () => {},
  leaveWhileDeleting: (navigate) => navigate(),
})

type DeletionLock = { identifier?: string } | null

export const AccountDeleteContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()

  const navigation = useNavigation()
  const [lock, setLock] = useState<DeletionLock>(null)
  const isLocked = lock !== null
  const isLeaving = useRef(false)

  /** The cover only hides the screen's body, so every way off it is taken away too.
   *  The header keeps a left view (an invisible, inert one) rather than none: with no left
   *  view react-native-screens shows the platform's own back arrow, and that one pops the
   *  screen natively, past both the swipe setting and the Android back key handler. */
  const setAccountIsBeingDeleted = useCallback(
    (isBeingDeleted: boolean, identifier?: string) => {
      isLeaving.current = false
      navigation.setOptions(
        isBeingDeleted
          ? { headerLeft: suppressedHeaderBack, gestureEnabled: false }
          : { headerLeft: defaultHeaderBack, gestureEnabled: true },
      )
      setLock(isBeingDeleted ? { identifier } : null)
    },
    [navigation],
  )

  const leaveWhileDeleting = useCallback((navigate: () => void) => {
    isLeaving.current = true
    navigate()
  }, [])

  /** Anything that still tries to remove the screen mid-removal is refused, except the
   *  navigation the removal itself runs once it lands. That includes the Android back key:
   *  the navigator turns it into a `goBack`, so it needs no listener of its own, and an
   *  app-wide one would outlive the screen if the screen were ever left on the stack.
   *  A refused action is marked as already seen by this screen, so dispatching it again
   *  lets it through. */
  usePreventRemove(isLocked, ({ data }) => {
    if (isLeaving.current) navigation.dispatch(data.action)
  })

  const value = useMemo(
    () => ({ setAccountIsBeingDeleted, leaveWhileDeleting }),
    [setAccountIsBeingDeleted, leaveWhileDeleting],
  )

  /** The screen stays mounted under an opaque cover rather than being swapped out: the
   *  component running the removal lives inside it and has to see the removal through,
   *  and the switch that happens mid-removal must not be visible through the cover. */
  return (
    <AccountDeleteContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {lock && (
          <View style={styles.cover} {...testProps("account-deletion-lock")}>
            <ActivityIndicator />
            {lock.identifier ? (
              <Text type="p1" bold>
                {lock.identifier}
              </Text>
            ) : null}
            <Text type="p2" color={colors.grey2}>
              {LL.AccountScreen.accountBeingDeleted()}
            </Text>
          </View>
        )}
      </View>
    </AccountDeleteContext.Provider>
  )
}

export const useAccountDeleteContext = () => useContext(AccountDeleteContext)

const useStyles = makeStyles(({ colors }) => ({
  fill: {
    flex: 1,
  },
  cover: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.white,
    display: "flex",
    flexDirection: "column",
    rowGap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
}))
