var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { useNavigation } from "@react-navigation/native";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { SupportOnboardingScreen } from "@app/screens/onboarding-screen";
import { ContextForScreen } from "../helper";
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: jest.fn() })); });
jest.mock("react-native/Libraries/Linking/Linking", function () { return ({
    openURL: jest.fn(),
    addEventListener: jest.fn(function () { return ({ remove: jest.fn() }); }),
    removeEventListener: jest.fn(),
    getInitialURL: jest.fn(),
    canOpenURL: jest.fn(),
}); });
var route = {
    key: "test-key",
    name: "supportScreen",
    params: {
        canGoBack: true,
    },
};
var FEEDBACK_EMAIL_ADDRESS = "feedback@blink.sv";
describe("SupportOnboardingScreen", function () {
    var LL;
    var mockAddListener = jest.fn(function () { return jest.fn(); });
    beforeEach(function () {
        ;
        useNavigation.mockReturnValue({
            addListener: mockAddListener,
        });
        mockAddListener.mockClear();
        loadLocale("en");
        LL = i18nObject("en");
    });
    it("renders title and description", function () {
        var getByText = render(<ContextForScreen>
        <SupportOnboardingScreen route={route}/>
      </ContextForScreen>).getByText;
        expect(getByText(LL.OnboardingScreen.supportScreen.description({ email: FEEDBACK_EMAIL_ADDRESS }))).toBeTruthy();
        expect(getByText(FEEDBACK_EMAIL_ADDRESS)).toBeTruthy();
    });
    it("renders icon with correct testID", function () {
        var getByTestId = render(<ContextForScreen>
        <SupportOnboardingScreen route={route}/>
      </ContextForScreen>).getByTestId;
        expect(getByTestId("icon-support")).toBeTruthy();
    });
    it("calls navigation.replace when primary action is pressed", function () {
        var mockReplace = jest.fn();
        useNavigation.mockReturnValue({
            replace: mockReplace,
            addListener: mockAddListener,
            navigate: mockReplace,
        });
        var getByText = render(<ContextForScreen>
        <SupportOnboardingScreen route={route}/>
      </ContextForScreen>).getByText;
        fireEvent.press(getByText(LL.OnboardingScreen.supportScreen.primaryButton()));
        expect(mockReplace).toHaveBeenCalledWith("Primary");
    });
});
//# sourceMappingURL=support-onboarding-screen.spec.js.map