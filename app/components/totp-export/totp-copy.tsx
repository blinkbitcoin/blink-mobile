import React, { useCallback, useEffect, useRef } from "react"
import { TouchableOpacity } from "react-native"
import Clipboard from "@react-native-clipboard/clipboard"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type Props = {
  secret: string
  /** Outlined in the primary colour where copying the key is the step to take. */
  isHighlighted?: boolean
  /** Told after each copy, for a screen that reports it. */
  onCopy?: () => void
}

type StyleProps = {
  isHighlighted: boolean
}

/** The key as an authenticator app takes it: whole, without the spaces it may be shown
 *  or typed with. */
export const compactSetupKey = (secret: string): string => secret.replace(/\s/g, "")

/** An authenticator's setup key, copied whole with a tap on the field or its icon. */
export const CopySecretComponent: React.FC<Props> = ({
  secret,
  isHighlighted = false,
  onCopy,
}) => {
  const { LL } = useI18nContext()
  /** No timed clear: clearing reads the clipboard back first, and the user has by then
   *  copied the code their authenticator made, so iOS would stop the registration with
   *  a paste permission prompt naming the authenticator app. */
  const { copyToClipboard } = useClipboard()
  /** The key would otherwise sit in the clipboard, and in whatever the system hands it
   *  on to, long after the registration, and it is the one string that recreates the
   *  second factor. So once the field is gone, a copy it made is wiped blind: a write
   *  alone raises no paste prompt, and whatever was copied after it goes too. A
   *  keyboard's own clipboard history keeps what it already took. */
  const hasCopiedRef = useRef(false)
  useEffect(
    () => () => {
      if (hasCopiedRef.current) Clipboard.setString("")
    },
    [],
  )
  const styles = useStyles({ isHighlighted })
  const {
    theme: { colors },
  } = useTheme()

  const handleCopy = useCallback(() => {
    copyToClipboard({
      content: compactSetupKey(secret),
      message: LL.CopySecretComponent.toastMessage(),
    })
    hasCopiedRef.current = true
    onCopy?.()
  }, [copyToClipboard, secret, LL, onCopy])

  return (
    <TouchableOpacity
      style={styles.field}
      onPress={handleCopy}
      activeOpacity={0.7}
      {...testProps("setup-key-copy")}
    >
      <Text type="p3" style={styles.key} numberOfLines={1} ellipsizeMode="middle">
        {secret}
      </Text>
      <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
    </TouchableOpacity>
  )
}

const useStyles = makeStyles(({ colors }, { isHighlighted }: StyleProps) => ({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isHighlighted ? colors.primary : colors.transparent,
    backgroundColor: colors.grey5,
  },
  key: {
    flex: 1,
    lineHeight: 20,
    color: colors.black,
  },
}))
