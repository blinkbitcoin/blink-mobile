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
import { LightningBenefitsScreen } from "@app/screens/onboarding-screen";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { ContextForScreen } from "../helper";
var route = {
    key: "test-key",
    name: "lightningBenefits",
    params: { onboarding: true },
};
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: jest.fn() })); });
describe("LightningBenefitsScreen", function () {
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
        <LightningBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        expect(getByText(LL.OnboardingScreen.lightningBenefits.title())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.lightningBenefits.staticAddressDescription())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.lightningBenefits.easyToShareDescription())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.lightningBenefits.blinkToolsDescription())).toBeTruthy();
    });
    it("renders icon with testID", function () {
        var getByTestId = render(<ContextForScreen>
        <LightningBenefitsScreen route={route}/>
      </ContextForScreen>).getByTestId;
        expect(getByTestId("icon-lightning-address")).toBeTruthy();
    });
    it("navigates to setLightningAddress on primary button press", function () {
        var mockNavigate = jest.fn();
        useNavigation.mockReturnValue({
            navigate: mockNavigate,
            addListener: mockAddListener,
        });
        var getByText = render(<ContextForScreen>
        <LightningBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        fireEvent.press(getByText(LL.OnboardingScreen.lightningBenefits.primaryButton()));
        expect(mockNavigate).toHaveBeenCalledWith("setLightningAddress", { onboarding: true });
    });
    it("navigates to supportScreen on secondary button press", function () {
        var mockNavigate = jest.fn();
        useNavigation.mockReturnValue({
            navigate: mockNavigate,
            addListener: mockAddListener,
        });
        var getByText = render(<ContextForScreen>
        <LightningBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        fireEvent.press(getByText(LL.UpgradeAccountModal.notNow()));
        expect(mockNavigate).toHaveBeenCalledWith("onboarding", { screen: "supportScreen" });
    });
    it("renders both action buttons", function () {
        var getByText = render(<ContextForScreen>
        <LightningBenefitsScreen route={route}/>
      </ContextForScreen>).getByText;
        expect(getByText(LL.OnboardingScreen.lightningBenefits.primaryButton())).toBeTruthy();
        expect(getByText(LL.UpgradeAccountModal.notNow())).toBeTruthy();
    });
});
//# sourceMappingURL=lightning-benefits-screen.spec.js.map