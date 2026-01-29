import React from "react"
import { ListItem, makeStyles } from "@rn-vui/themed"

import { Switch } from "@app/components/atomic/switch"

type TransactionTypeRowProps = {
  title: string
  description: string
  value: boolean
  onValueChange: () => void
}

export const TransactionTypeRow: React.FC<TransactionTypeRowProps> = ({
  title,
  description,
  value,
  onValueChange,
}) => {
  const styles = useStyles()
  return (
    <ListItem containerStyle={styles.listItemContainer}>
      <ListItem.Content>
        <ListItem.Title style={styles.listItemTitle}>{title}</ListItem.Title>
        <ListItem.Subtitle style={styles.listItemSubtitle}>
          {description}
        </ListItem.Subtitle>
      </ListItem.Content>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </ListItem>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listItemContainer: {
    backgroundColor: colors.transparent,
    paddingVertical: 8,
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
    fontSize: 14,
    lineHeight: 16,
  },
}))
