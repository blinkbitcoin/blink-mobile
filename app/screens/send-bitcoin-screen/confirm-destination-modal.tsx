import React, { Dispatch, useCallback, useState } from "react"
import { View, TouchableOpacity } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { CheckBox, Text, makeStyles, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import {
  DestinationState,
  SendBitcoinActions,
  SendBitcoinDestinationAction,
  SendBitcoinDestinationState,
} from "./send-bitcoin-reducer"

export type ConfirmDestinationModalProps = {
  destinationState: SendBitcoinDestinationState
  dispatchDestinationStateAction: Dispatch<SendBitcoinDestinationAction>
}

export const ConfirmDestinationModal: React.FC<ConfirmDestinationModalProps> = ({
  destinationState,
  dispatchDestinationStateAction,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const { lnAddressHostname: lnDomain, name: bankName } = appConfig.galoyInstance
  const [confirmationEnabled, setConfirmationEnabled] = useState(false)
  const confirmDestination = useCallback(() => {
    dispatchDestinationStateAction({
      type: SendBitcoinActions.SetConfirmed,
      payload: { unparsedDestination: destinationState.unparsedDestination },
    })
  }, [destinationState, dispatchDestinationStateAction])

  if (destinationState.destinationState !== DestinationState.RequiresUsernameConfirmation)
    return null

  const lnAddress = destinationState?.confirmationUsernameType?.username + "@" + lnDomain

  const goBack = () => {
    dispatchDestinationStateAction({
      type: SendBitcoinActions.SetUnparsedDestination,
      payload: { unparsedDestination: destinationState.unparsedDestination },
    })
  }

  return (
    <CustomModal
      isVisible={
        destinationState.destinationState ===
        DestinationState.RequiresUsernameConfirmation
      }
      toggleModal={goBack}
      title={LL.SendBitcoinDestinationScreen.confirmUsernameModal.title()}
      image={<GaloyIcon name="info" size={100} color={colors.primary3} />}
      body={
        <View style={styles.body}>
          <Text type={"p2"} color={colors.warning} style={styles.warningText}>
            {LL.SendBitcoinDestinationScreen.confirmUsernameModal.warning({
              bankName,
            })}
          </Text>
        </View>
      }
      nonScrollingContent={
        <TouchableOpacity
          style={styles.checkBoxTouchable}
          onPress={() => setConfirmationEnabled(!confirmationEnabled)}
        >
          <View style={styles.checkBoxContainer}>
            <CheckBox
              {...testProps(
                LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                  lnAddress,
                }),
              )}
              containerStyle={styles.checkBox}
              checked={confirmationEnabled}
              iconType="ionicon"
              checkedIcon={"checkbox"}
              uncheckedIcon={"square-outline"}
              onPress={() => setConfirmationEnabled(!confirmationEnabled)}
            />
            <Text testID="address-is-right" type={"p2"} style={styles.checkBoxText}>
              {LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                lnAddress,
              })}
            </Text>
          </View>
        </TouchableOpacity>
      }
      primaryButtonOnPress={confirmDestination}
      primaryButtonDisabled={!confirmationEnabled}
      primaryButtonTitle={LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()}
      secondaryButtonTitle={LL.common.back()}
      secondaryButtonOnPress={goBack}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
  },
  warningText: {
    textAlign: "center",
  },
  body: {
    rowGap: 12,
  },
  buttonContainer: {
    rowGap: 12,
  },
  titleContainer: {
    marginBottom: 12,
  },
  checkBox: {
    paddingLeft: 0,
    backgroundColor: "transparent",
  },
  checkBoxTouchable: {
    marginTop: 12,
  },
  checkBoxContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
  },
  checkBoxText: {
    flex: 1,
  },
}))
