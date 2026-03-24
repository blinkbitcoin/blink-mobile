import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupConfirmScreen } from "@app/screens/spark-onboarding/manual-backup/backup-confirm-screen"
import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({
    params: {
      challenges: [
        { index: 0, word: "youth" },
        { index: 4, word: "bundle" },
        { index: 8, word: "harvest" },
      ],
    },
  }),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("SparkBackupConfirmScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders subtitle and input fields", () => {
    const { getByText, getByPlaceholderText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.ManualBackup.Confirm.subtitle())).toBeTruthy()
    expect(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 1`),
    ).toBeTruthy()
    expect(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 5`),
    ).toBeTruthy()
    expect(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 9`),
    ).toBeTruthy()
  })

  it("shows enter words label when inputs are empty", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.ManualBackup.Confirm.enterWords())).toBeTruthy()
  })

  it("shows confirm label when all inputs are filled correctly", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 1`),
      "youth",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 5`),
      "bundle",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 9`),
      "harvest",
    )

    expect(getByText(LL.SparkOnboarding.ManualBackup.Confirm.confirm())).toBeTruthy()
  })

  it("does not navigate when words are incorrect", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 1`),
      "wrong",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 5`),
      "wrong",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 9`),
      "wrong",
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Confirm.confirm()))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("navigates to success screen on correct words", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 1`),
      "youth",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 5`),
      "bundle",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 9`),
      "harvest",
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Confirm.confirm()))
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("shows autocomplete suggestions when typing 3+ characters", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 1`),
      "you",
    )

    expect(getByText("young")).toBeTruthy()
    expect(getByText("youth")).toBeTruthy()
  })

  it("fills input when suggestion is selected", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    const input = getByPlaceholderText(
      `${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 1`,
    )
    fireEvent.changeText(input, "you")
    fireEvent.press(getByText("youth"))

    expect(input.props.value).toBe("youth")
  })

  it("accepts case-insensitive input", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 1`),
      "YOUTH",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 5`),
      "Bundle",
    )
    fireEvent.changeText(
      getByPlaceholderText(`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} 9`),
      "HARVEST",
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Confirm.confirm()))
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })
})
