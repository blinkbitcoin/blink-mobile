import React from "react"
import { utils } from "lnurl-pay"
import { View, Text, TouchableOpacity, Linking } from "react-native"
import { makeStyles } from "@rn-vui/themed"
import { useI18nContext } from "@app/i18n/i18n-react"
import { SuccessActionComponentProps, SuccessActionTag } from "./success-action.props"
import { FieldWithCopy } from "./field-with-copy"

export const SuccessActionComponent: React.FC<SuccessActionComponentProps> = ({
  successAction,
  preimage,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  if (!successAction) return null

  const { tag, message, description, url } = successAction
  const decryptedMessage =
    tag === SuccessActionTag.AES && preimage
      ? utils.decipherAES({ successAction, preimage })
      : null

  return (
    <View style={styles.successActionContainer}>
      {tag === SuccessActionTag.MESSAGE && message && (
        <>
          <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
          <FieldWithCopy
            text={message}
            copiedMessage={LL.SendBitcoinScreen.copiedSuccessMessage()}
            accessibilityLabel={LL.SendBitcoinScreen.copySuccessMessage()}
          />
        </>
      )}

      {tag === SuccessActionTag.URL && (
        <>
          {description && (
            <>
              <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
              <FieldWithCopy
                text={description}
                copiedMessage={LL.SendBitcoinScreen.copiedSuccessMessage()}
                accessibilityLabel={LL.SendBitcoinScreen.copySecretMessage()}
              />
            </>
          )}
          <TouchableOpacity
            style={styles.copyUrlButton}
            onPress={() => Linking.openURL(url!)}
            accessibilityLabel={LL.SendBitcoinScreen.openSuccessUrl()}
            hitSlop={styles.hitSlopIcon}
          >
            <Text style={styles.copyUrlButtonText}>
              {LL.ScanningQRCodeScreen.openLinkTitle()}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {tag === SuccessActionTag.AES && (
        <>
          <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
          {description && (
            <FieldWithCopy
              text={description}
              copiedMessage={LL.SendBitcoinScreen.copiedSuccessMessage()}
              accessibilityLabel={LL.SendBitcoinScreen.copySuccessMessage()}
            />
          )}
          {decryptedMessage ? (
            <FieldWithCopy
              text={decryptedMessage}
              copiedMessage={LL.SendBitcoinScreen.copiedSecretMessage()}
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
  copyUrlButton: {
    backgroundColor: colors.grey5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  copyUrlButtonText: {
    fontSize: 16,
    textAlign: "center",
    color: colors.grey1,
  },
}))
