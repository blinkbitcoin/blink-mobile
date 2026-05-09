import React from "react"
import { render } from "@testing-library/react-native"
import { Pressable, Text } from "react-native"

import { IconHero } from "@app/components/icon-hero"
import { SparkRestoreMethodScreen } from "@app/screens/spark-onboarding/restore/restore-method-screen"
import theme from "@app/rne-theme/theme"

import { ContextForScreen } from "../../helper"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn() }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Main" } } }),
  useKeychainBackup: () => ({ read: jest.fn(), loading: false }),
}))

jest.mock("@app/screens/spark-onboarding/restore/hooks/use-restore-wallet", () => ({
  useRestoreWallet: () => ({ restore: jest.fn() }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <Pressable testID={`primary-${title}`} onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  ),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <Pressable testID={`secondary-${title}`} onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  ),
}))

jest.mock("@app/components/icon-hero", () => ({
  IconHero: jest.fn(({ title, subtitle }: { title: string; subtitle: string }) => (
    <>
      <Text>{title}</Text>
      <Text>{subtitle}</Text>
    </>
  )),
}))

describe("SparkRestoreMethodScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the hero icon with the success color", () => {
    render(
      <ContextForScreen>
        <SparkRestoreMethodScreen />
      </ContextForScreen>,
    )

    const iconHeroMock = IconHero as unknown as jest.Mock
    const props = iconHeroMock.mock.calls[0][0]

    expect(props.iconColor).toBe(theme.lightColors?.success)
    expect(props.icon).toBe("cloud")
  })
})
