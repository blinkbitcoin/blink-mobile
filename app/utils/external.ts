import { Linking } from "react-native"
import InAppBrowser from "react-native-inappbrowser-reborn"

export const openWhatsApp: (number: string, message: string) => Promise<void> = async (
  number: string,
  message: string,
) =>
  Linking.openURL(
    `whatsapp://send?phone=${encodeURIComponent(number)}&text=${encodeURIComponent(
      message,
    )}`,
  )

export const openExternalUrl = async (url: string): Promise<void> => {
  try {
    await InAppBrowser.open(url)
  } catch {
    await Linking.openURL(url)
  }
}
