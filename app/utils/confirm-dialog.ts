import { Alert } from "react-native"

type ConfirmDialogParams = {
  title: string
  message: string
  labels: {
    cancel: string
    confirm: string
  }
}

export const confirmDialog = ({
  title,
  message,
  labels,
}: ConfirmDialogParams): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: labels.cancel, style: "cancel", onPress: () => resolve(false) },
      { text: labels.confirm, style: "destructive", onPress: () => resolve(true) },
    ])
  })
