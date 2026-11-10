import React from "react"
import { ListItem, makeStyles } from "@rn-vui/themed"

import { Switch } from "@app/components/atomic/switch"

type SwitchRowProps = {
  title: string
  description?: string
  value?: boolean
  onValueChange?: (value: boolean) => void
  disabled?: boolean
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  title,
  description,
  value = false,
  onValueChange = () => {},
  disabled = false,
}) => {
  const styles = useStyles()
  return (
    <ListItem containerStyle={styles.listItemContainer}>
      <ListItem.Content>
        <ListItem.Title style={styles.listItemTitle}>{title}</ListItem.Title>
        {description && (
          <ListItem.Subtitle style={styles.listItemSubtitle}>
            {description}
          </ListItem.Subtitle>
        )}
      </ListItem.Content>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
      />
    </ListItem>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listItemContainer: {
    backgroundColor: colors.transparent,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 0,
  },
  listItemTitle: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  listItemSubtitle: {
    color: colors.grey2,
    fontWeight: "400",
    fontSize: 14,
    lineHeight: 16,
  },
}))
