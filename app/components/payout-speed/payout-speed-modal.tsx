import React from "react"
import ReactNativeModal from "react-native-modal"
import { ListItem, makeStyles, useTheme, Icon } from "@rn-vui/themed"

import { PayoutSpeed } from "@app/graphql/generated"

export type PayoutSpeedOption = {
  speed: PayoutSpeed
  displayName: string
  description?: string
}

type PayoutSpeedModalProps = {
  options: PayoutSpeedOption[]
  selectedSpeed?: PayoutSpeed
  isVisible: boolean
  toggleModal: () => void
  onSelect: (option: PayoutSpeedOption) => void
  estimatedFeeBySpeed?: Partial<Record<PayoutSpeed, string>>
}

export const PayoutSpeedModal: React.FC<PayoutSpeedModalProps> = ({
  isVisible,
  toggleModal,
  options,
  selectedSpeed,
  onSelect,
  estimatedFeeBySpeed,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <ReactNativeModal
      isVisible={isVisible}
      backdropOpacity={0.8}
      backdropColor={colors.white}
      onBackdropPress={toggleModal}
      style={styles.modal}
    >
      {options.map((option) => {
        const isSelected = option.speed === selectedSpeed
        const estimatedFeeText = estimatedFeeBySpeed?.[option.speed]

        return (
          <ListItem
            key={option.speed}
            bottomDivider
            onPress={() => {
              onSelect(option)
              toggleModal()
            }}
            containerStyle={styles.listItemContainer}
          >
            <Icon
              name={isSelected ? "radio-button-on-outline" : "radio-button-off-outline"}
              type="ionicon"
              color={colors.primary}
            />
            <ListItem.Content>
              <ListItem.Title style={styles.listItemTitle}>
                {option.displayName}
              </ListItem.Title>

              {option.description ? (
                <ListItem.Subtitle style={styles.listItemSubtitle}>
                  {option.description}
                </ListItem.Subtitle>
              ) : null}

              {estimatedFeeText ? (
                <ListItem.Subtitle style={styles.estimateFee}>
                  {estimatedFeeText}
                </ListItem.Subtitle>
              ) : null}
            </ListItem.Content>
          </ListItem>
        )
      })}
    </ReactNativeModal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  modal: {
    justifyContent: "flex-end",
    flexGrow: 1,
    marginHorizontal: 0,
  },
  listItemContainer: {
    backgroundColor: colors.grey5,
  },
  listItemTitle: {
    color: colors.black,
    fontWeight: "bold",
  },
  listItemSubtitle: {
    color: colors.grey1,
    marginTop: 4,
  },
  estimateFee: {
    color: colors.grey1,
    marginTop: 6,
  },
}))
