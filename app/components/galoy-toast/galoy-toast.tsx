import * as React from "react"
import Toast, {
  SuccessToast,
  ErrorToast,
  BaseToastProps,
} from "react-native-toast-message"

import { light } from "../../rne-theme/colors"

const styles = {
  text1StyleSuccess: {
    fontSize: 16,
    color: light._green,
  },
  text1StyleError: {
    fontSize: 16,
    color: light.red,
  },
  text1StyleWarning: {
    fontSize: 16,
    color: light.warning,
  },
  text2Style: {
    fontSize: 14,
    color: light._black,
  },
  container: {
    height: undefined,
    paddingVertical: 5,
  },
}

const toastConfig = {
  success: (props: BaseToastProps) => (
    <SuccessToast
      {...props}
      text2NumberOfLines={2}
      style={[{ borderLeftColor: light._green }, styles.container]}
      text1Style={styles.text1StyleSuccess}
      text2Style={styles.text2Style}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      text2NumberOfLines={2}
      style={[{ borderLeftColor: light.red }, styles.container]}
      text1Style={styles.text1StyleError}
      text2Style={styles.text2Style}
    />
  ),
  warning: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      text2NumberOfLines={2}
      style={[{ borderLeftColor: light.warning }, styles.container]}
      text1Style={styles.text1StyleWarning}
      text2Style={styles.text2Style}
    />
  ),
}

export const GaloyToast = () => {
  return <Toast config={toastConfig} />
}
