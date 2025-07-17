const mockHapticFeedback = {
  trigger: jest.fn(),
  HapticFeedbackTypes: {
    selection: "selection",
    impactLight: "impactLight",
    impactMedium: "impactMedium",
    impactHeavy: "impactHeavy",
    notificationSuccess: "notificationSuccess",
    notificationWarning: "notificationWarning",
    notificationError: "notificationError",
  },
}

export default mockHapticFeedback
