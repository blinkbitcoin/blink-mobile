import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { ActivityIndicator, View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

type AccountDeleteContextType = {
  /** `identifier` names the account on the lock screen: a removal switches the active
   *  account before it finishes, so anything read live would already name the next one. */
  setAccountIsBeingDeleted: (isBeingDeleted: boolean, identifier?: string) => void
}

const AccountDeleteContext = createContext<AccountDeleteContextType>({
  setAccountIsBeingDeleted: () => {},
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

  const [lock, setLock] = useState<DeletionLock>(null)

  const setAccountIsBeingDeleted = useCallback(
    (isBeingDeleted: boolean, identifier?: string) =>
      setLock(isBeingDeleted ? { identifier } : null),
    [],
  )

  const value = useMemo(() => ({ setAccountIsBeingDeleted }), [setAccountIsBeingDeleted])

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
