import ScreenGuard from "react-native-screenguard"

export const enableScreenSecurity = async (backgroundColor: string): Promise<void> => {
  await ScreenGuard.initSettings()
  await ScreenGuard.register({ backgroundColor })
}

export const disableScreenSecurity = async (): Promise<void> => {
  await ScreenGuard.unregister()
}
