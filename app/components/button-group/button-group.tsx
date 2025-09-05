import React from "react"
import { StyleProp, TouchableWithoutFeedback, View, ViewStyle } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"

import { testProps } from "@app/utils/testProps"
import { Text, makeStyles } from "@rn-vui/themed"

type ButtonForButtonGroupProps = {
  id: string
  text: string
  icon:
    | string
    | {
        selected: React.ReactElement
        normal: React.ReactElement
      }
  disabled?: boolean
}

const ButtonForButtonGroup: React.FC<
  ButtonForButtonGroupProps & {
    selected: boolean
    onPress: () => void
  }
> = ({ text, icon, selected, onPress, disabled }) => {
  const styles = useStyles({ selected: Boolean(selected), disabled: Boolean(disabled) })
  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View style={styles.button}>
        <Text
          {...testProps(text)}
          style={styles.text}
          ellipsizeMode="tail"
          numberOfLines={1}
        >
          {text}
        </Text>
        {typeof icon === "string" ? (
          <Icon style={styles.text} name={icon} />
        ) : selected ? (
          icon.selected
        ) : (
          icon.normal
        )}
      </View>
    </TouchableWithoutFeedback>
  )
}

export type ButtonGroupProps = {
  selectedId: string
  buttons: ButtonForButtonGroupProps[]
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  onPress: (id: string) => void
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  buttons,
  selectedId,
  onPress,
  style,
  disabled,
}) => {
  const styles = useStyles()
  const selectedButton = buttons.find(({ id }) => id === selectedId)

  return (
    <View style={[styles.buttonGroup, style]}>
      {!disabled &&
        buttons.map((props) => (
          <ButtonForButtonGroup
            key={props.id}
            {...props}
            onPress={() => {
              if (selectedId !== props.id) {
                onPress(props.id)
              }
            }}
            selected={selectedId === props.id}
          />
        ))}
      {disabled && selectedButton && (
        <ButtonForButtonGroup {...selectedButton} selected={true} onPress={() => {}} />
      )}
    </View>
  )
}

const useStyles = makeStyles(
  ({ colors }, { selected, disabled }: { selected: boolean; disabled: boolean }) => ({
    button: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 10,
      paddingVertical: 14,
      borderRadius: 8,
      opacity: disabled ? 0.4 : 1,
      backgroundColor: colors.grey5,
      height: "100%",
    },
    text: {
      fontSize: 16,
      color: selected ? colors.primary : colors.grey1,
    },
    buttonGroup: {
      flexDirection: "row",
      columnGap: 10,
      justifyContent: "space-between",
      alignItems: "center",
    },
  }),
)
