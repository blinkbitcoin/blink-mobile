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
import { EmailBenefitsScreen } from "@app/screens/onboarding-screen";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { ContextForScreen } from "../helper";
var route = {
    key: "email-benefits",
    name: "emailBenefits",
    params: {
        onboarding: true,
        hasUsername: true,
    },
};
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: jest.fn() })); });
describe("EmailBenefitsScreen", function () {
    var LL;
    beforeEach(function () {
        loadLocale("en");
        LL = i18nObject("en");
        jest.clearAllMocks();
    });
    it("Renders localized title and descriptions", function () {
        var getByText = render(<ContextForScreen>
        <EmailBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        expect(getByText(LL.OnboardingScreen.emailBenefits.title())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.emailBenefits.backupDescription())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.emailBenefits.supportDescription())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.emailBenefits.securityDescription())).toBeTruthy();
    });
    it("Renders primary and secondary buttons", function () {
        var getByText = render(<ContextForScreen>
        <EmailBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        expect(getByText(LL.OnboardingScreen.emailBenefits.primaryButton())).toBeTruthy();
        expect(getByText(LL.UpgradeAccountModal.notNow())).toBeTruthy();
    });
    it("Triggers primary action and navigates to emailRegistrationInitiate", function () {
        var mockNavigate = jest.fn();
        var mockAddListener = jest.fn();
        useNavigation.mockReturnValue({
            navigate: mockNavigate,
            addListener: mockAddListener,
        });
        var getByText = render(<ContextForScreen>
        <EmailBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        fireEvent.press(getByText(LL.OnboardingScreen.emailBenefits.primaryButton()));
        expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationInitiate", {
            onboarding: true,
            hasUsername: true,
        });
    });
    it("Triggers secondary action and navigates to supportScreen when username exists", function () {
        var mockNavigate = jest.fn();
        var mockAddListener = jest.fn();
        useNavigation.mockReturnValue({
            navigate: mockNavigate,
            addListener: mockAddListener,
        });
        var getByText = render(<ContextForScreen>
        <EmailBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        fireEvent.press(getByText(LL.UpgradeAccountModal.notNow()));
        expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
            screen: "supportScreen",
        });
    });
    it("Triggers secondary action and navigates to lightningBenefits when no username", function () {
        var mockNavigate = jest.fn();
        var mockAddListener = jest.fn();
        useNavigation.mockReturnValue({
            navigate: mockNavigate,
            addListener: mockAddListener,
        });
        var mockRoute = __assign(__assign({}, route), { params: __assign(__assign({}, route.params), { hasUsername: false }) });
        var getByText = render(<ContextForScreen>
        <EmailBenefitsScreen route={mockRoute}/>
      </ContextForScreen>).getByText;
        fireEvent.press(getByText(LL.UpgradeAccountModal.notNow()));
        expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
            screen: "lightningBenefits",
            params: { onboarding: true },
        });
    });
});
//# sourceMappingURL=email-benefits-screen.spec.js.map