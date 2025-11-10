import React from "react"
import { testProps } from "@app/utils/testProps"
import { Button, Skeleton, makeStyles } from "@rn-vui/themed"

type Props = {
  title: string
  onPress: () => void
  variant: "warning" | "danger"
  loading?: boolean
}

export const SettingsButton: React.FC<Props> = ({ title, onPress, variant, loading }) => {
  const styles = useStyles(variant)

  if (loading) return <Skeleton style={styles.containerStyle} />

  return (
    <Button
      title={title}
      {...testProps(title)}
      onPress={onPress}
      titleStyle={styles.titleStyle}
      containerStyle={styles.containerStyle}
      buttonStyle={styles.buttonStyle}
    />
  )
}

const useStyles = makeStyles(({ colors }, variant: "warning" | "danger") => ({
  containerStyle: {
    height: 42,
    borderRadius: 12,
  },
  buttonStyle: {
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.grey5,
  },
  titleStyle: {
    color: variant === "warning" ? colors.primary : colors.red,
  },
}))
