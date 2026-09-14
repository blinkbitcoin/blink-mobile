import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { AccountMode } from "@app/types/account"
import { testProps } from "@app/utils/testProps"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../atomic/galoy-icon"
import CustomModal from "../custom-modal/custom-modal"

type EnhancedModePromptContextType = {
  promptEnhancedMode: () => void
  /** Surfaces that coordinate concurrent modals (e.g. Home) read this. */
  isEnhancedModePromptVisible: boolean
}

const EnhancedModePromptContext = createContext<EnhancedModePromptContextType>({
  promptEnhancedMode: () => {},
  isEnhancedModePromptVisible: false,
})

export const useEnhancedModePrompt = (): EnhancedModePromptContextType =>
  useContext(EnhancedModePromptContext)

type PromptModalProps = {
  onDismiss: () => void
}

const EnhancedModePromptModal: React.FC<PromptModalProps> = ({ onDismiss }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { isAnonMode, setActiveAccountMode } = useSelfCustodialAccountMode()

  const switchToEnhanced = () => {
    /** Only an Anon account can switch, and only a real write may confirm success. */
    if (isAnonMode) {
      setActiveAccountMode(AccountMode.Enhanced)
      navigation.navigate("selfCustodialModeSwitchSuccess", {
        mode: AccountMode.Enhanced,
      })
    }
    onDismiss()
  }

  return (
    <CustomModal
      isVisible={true}
      toggleModal={onDismiss}
      showCloseIconButton={true}
      image={
        <GaloyIcon
          name="warning"
          size={52}
          color={colors.primary}
          {...testProps("enhanced-mode-prompt-icon")}
        />
      }
      title={LL.EnhancedModePrompt.title()}
      titleMaxWidth="100%"
      body={<Text style={styles.description}>{LL.EnhancedModePrompt.body()}</Text>}
      primaryButtonTitle={LL.EnhancedModePrompt.switchButton()}
      primaryButtonOnPress={switchToEnhanced}
      secondaryButtonTitle={LL.common.notNow()}
      secondaryButtonOnPress={onDismiss}
      {...testProps("enhanced-mode-prompt")}
    />
  )
}

/** Hosts the single Anon-gate prompt. The modal mounts only while visible: nothing on
 *  the startup path, and closing removes the native window over the success screen. */
export const EnhancedModePromptProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false)

  const promptEnhancedMode = useCallback(() => setIsVisible(true), [])
  const dismiss = useCallback(() => setIsVisible(false), [])

  const contextValue = useMemo(
    () => ({ promptEnhancedMode, isEnhancedModePromptVisible: isVisible }),
    [promptEnhancedMode, isVisible],
  )

  return (
    <EnhancedModePromptContext.Provider value={contextValue}>
      {children}
      {isVisible && <EnhancedModePromptModal onDismiss={dismiss} />}
    </EnhancedModePromptContext.Provider>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
  },
}))
