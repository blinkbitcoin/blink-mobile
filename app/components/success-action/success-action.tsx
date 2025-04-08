import React from "react"
import { utils } from "lnurl-pay"
import { View, Text, Linking, TouchableOpacity } from "react-native"
import { makeStyles, useTheme } from "@rneui/themed"
import { useI18nContext } from "@app/i18n/i18n-react"
import { SuccessActionComponentProps, SuccessActionTag } from "./success-action.props"
import { FieldWithIconEvent } from "./field-with-icon"
import Clipboard from "@react-native-clipboard/clipboard"
import { toastShow } from "@app/utils/toast"
import { GaloyIcon } from "../atomic/galoy-icon"

export const SuccessActionComponent: React.FC<SuccessActionComponentProps> = ({
  successAction,
  preimage,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  if (!successAction) return null

  const { tag, message, description, url } = successAction
  const decryptedMessage =
    tag === SuccessActionTag.AES && preimage
      ? utils.decipherAES({ successAction, preimage })
      : null

  const copyToClipboard = (text: string, message: string) => {
    Clipboard.setString(text)
    toastShow({ type: "success", message, LL })
  }

  return (
    <View style={styles.successActionContainer}>
      {tag === SuccessActionTag.MESSAGE && message && (
        <FieldWithIconEvent
          text={message}
          event={() =>
            copyToClipboard(message, LL.SendBitcoinScreen.copiedSuccessMessage())
          }
          iconName="copy-paste"
          accessibilityLabel={LL.SendBitcoinScreen.copySuccessMessage()}
        />
      )}

      {tag === SuccessActionTag.URL && (
        <>
          <FieldWithIconEvent
            text={`${description} ${url!}`}
            event={() =>
              copyToClipboard(
                `${description} ${url!}`,
                LL.SendBitcoinScreen.copiedSuccessMessage(),
              )
            }
            iconName="copy-paste"
            accessibilityLabel={LL.SendBitcoinScreen.copySecretMessage()}
          />
          <TouchableOpacity
            style={styles.urlButton}
            onPress={() => Linking.openURL(url!)}
            accessibilityLabel={LL.SendBitcoinScreen.openSuccessUrl()}
            hitSlop={styles.hitSlopIcon}
          >
            <Text style={styles.urlButtonText}>
              {LL.ScanningQRCodeScreen.openLinkTitle()}
            </Text>
            <GaloyIcon name={"open-link"} size={14} color={colors.primary} />
          </TouchableOpacity>
        </>
      )}

      {tag === SuccessActionTag.AES && (
        <>
          <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
          {description && (
            <FieldWithIconEvent
              text={description}
              event={() =>
                copyToClipboard(description, LL.SendBitcoinScreen.copiedSuccessMessage())
              }
              iconName="copy-paste"
              accessibilityLabel={LL.SendBitcoinScreen.copySuccessMessage()}
            />
          )}
          {decryptedMessage ? (
            <FieldWithIconEvent
              text={decryptedMessage}
              event={() =>
                copyToClipboard(
                  decryptedMessage,
                  LL.SendBitcoinScreen.copiedSecretMessage(),
                )
              }
              iconName="copy-paste"
              accessibilityLabel={LL.SendBitcoinScreen.copySecretMessage()}
            />
          ) : (
            <Text style={styles.encryptionPendingText}>
              {LL.SendBitcoinScreen.pendingDecryptionMessage()}
            </Text>
          )}
        </>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  successActionContainer: {
    minWidth: "100%",
    paddingHorizontal: 40,
    marginTop: 30,
  },
  fieldTitleText: {
    fontWeight: "bold",
    marginBottom: 4,
    color: colors.grey1,
  },
  encryptionPendingText: {
    fontSize: 14,
    color: colors.grey3,
    textAlign: "center",
    marginTop: 10,
  },
  hitSlopIcon: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
  urlButton: {
    backgroundColor: colors.grey5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: "center",
    gap: 15,
  },
  urlButtonText: {
    fontSize: 16,
    textAlign: "center",
    color: colors.grey1,
  },
}))
