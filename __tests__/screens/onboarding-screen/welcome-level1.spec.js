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
import { useNavigation } from "@react-navigation/native";
import { render, fireEvent } from "@testing-library/react-native";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { WelcomeLevel1Screen } from "@app/screens/onboarding-screen";
import { ContextForScreen } from "../helper";
var route = {
    key: "test-key",
    name: "welcomeLevel1",
    params: {
        onboarding: true,
    },
};
var usernameMock = {
    loading: false,
    data: {
        me: {
            username: "userexample",
        },
    },
};
jest.mock("@app/graphql/generated", function () { return (__assign(__assign({}, jest.requireActual("@app/graphql/generated")), { useSettingsScreenQuery: jest.fn() })); });
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: jest.fn() })); });
describe("WelcomeLevel1Screen", function () {
    var LL;
    var mockAddListener = jest.fn(function () { return jest.fn(); });
    beforeEach(function () {
        ;
        useSettingsScreenQuery.mockReturnValue(usernameMock);
        useNavigation.mockReturnValue({
            addListener: mockAddListener,
        });
        mockAddListener.mockClear();
        loadLocale("en");
        LL = i18nObject("en");
    });
    it("Renders localized title and description lines", function () {
        var getByText = render(<ContextForScreen>
        <WelcomeLevel1Screen route={route}/>
      </ContextForScreen>).getByText;
        expect(getByText(LL.OnboardingScreen.welcomeLevel1.title())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.welcomeLevel1.receiveBitcoinDescription())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription())).toBeTruthy();
        expect(getByText(LL.OnboardingScreen.welcomeLevel1.onchainDescription())).toBeTruthy();
    });
    it("Triggers primary action button with label", function () {
        var mockReplace = jest.fn();
        useNavigation.mockReturnValue({
            replace: mockReplace,
            addListener: mockAddListener,
            navigate: mockReplace,
        });
        var getByText = render(<ContextForScreen>
        <WelcomeLevel1Screen route={route}/>
      </ContextForScreen>).getByText;
        var primaryBtn = getByText(LL.common.next());
        fireEvent.press(primaryBtn);
        expect(mockReplace).toHaveBeenCalledWith("onboarding", {
            screen: "emailBenefits",
            params: {
                onboarding: true,
                hasUsername: true,
            },
        });
    });
});
//# sourceMappingURL=welcome-level1.spec.js.map