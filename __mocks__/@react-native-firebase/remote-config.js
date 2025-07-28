const remoteConfig = {
  fetchAndActivate: jest.fn(() => Promise.resolve(true)),

  getValue: jest.fn((key) => ({
    asBoolean: () => {
      if (key === "deviceAccountEnabledRestAuth") return false
      return false
    },
    asNumber: () => {
      if (key === "balanceLimitToTriggerUpgradeModal") return 2100
      return 0
    },
    asString: () => {
      if (key === "feedbackEmailAddress") return "feedback@blink.sv"
      return ""
    },
  })),

  setDefaults: jest.fn(),
  setConfigSettings: jest.fn(),
}

export default () => remoteConfig
