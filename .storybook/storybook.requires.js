/* do not change this file, it is auto generated by storybook. */

import {
  configure,
  addDecorator,
  addParameters,
  addArgsEnhancer,
  clearDecorators,
} from "@storybook/react-native";

global.STORIES = [
  {
    titlePrefix: "",
    directory: "./app",
    files: "**/*.stories.?(ts|tsx)",
    importPathMatcher:
      "^\\.[\\\\/](?:app(?:\\/(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\/|\\/|$)(?!\\.)(?=.)[^/]*?\\.stories\\.(?:ts|tsx)?)$",
  },
];

import "@storybook/addon-ondevice-notes/register";
import "@storybook/addon-ondevice-controls/register";
import "@storybook/addon-ondevice-knobs/register";
import "@storybook/addon-ondevice-backgrounds/register";
import "@storybook/addon-ondevice-actions/register";

import { argsEnhancers } from "@storybook/addon-actions/dist/modern/preset/addArgs";

try {
  argsEnhancers.forEach((enhancer) => addArgsEnhancer(enhancer));
} catch {}

const getStories = () => {
  return {
    "./app/components/amount-input-screen/amount-input-screen.stories.tsx": require("../app/components/amount-input-screen/amount-input-screen.stories.tsx"),
    "./app/components/amount-input/amount-input.stories.tsx": require("../app/components/amount-input/amount-input.stories.tsx"),
    "./app/components/app-update/app-update.stories.tsx": require("../app/components/app-update/app-update.stories.tsx"),
    "./app/components/atomic/galoy-button-field/galoy-button-field.stories.tsx": require("../app/components/atomic/galoy-button-field/galoy-button-field.stories.tsx"),
    "./app/components/atomic/galoy-currency-bubble/galoy-currency-bubble.stories.tsx": require("../app/components/atomic/galoy-currency-bubble/galoy-currency-bubble.stories.tsx"),
    "./app/components/atomic/galoy-icon-button/galoy-icon-button.stories.tsx": require("../app/components/atomic/galoy-icon-button/galoy-icon-button.stories.tsx"),
    "./app/components/atomic/galoy-icon/galoy-icon.stories.tsx": require("../app/components/atomic/galoy-icon/galoy-icon.stories.tsx"),
    "./app/components/atomic/galoy-info/galoy-info.stories.tsx": require("../app/components/atomic/galoy-info/galoy-info.stories.tsx"),
    "./app/components/atomic/galoy-input/galoy-input.stories.tsx": require("../app/components/atomic/galoy-input/galoy-input.stories.tsx"),
    "./app/components/atomic/galoy-primary-button/galoy-primary-button.stories.tsx": require("../app/components/atomic/galoy-primary-button/galoy-primary-button.stories.tsx"),
    "./app/components/atomic/galoy-secondary-button/galoy-secondary-button.stories.tsx": require("../app/components/atomic/galoy-secondary-button/galoy-secondary-button.stories.tsx"),
    "./app/components/atomic/galoy-tertiary-button/galoy-tertiary-button.stories.tsx": require("../app/components/atomic/galoy-tertiary-button/galoy-tertiary-button.stories.tsx"),
    "./app/components/atomic/galoy-warning/galoy-warning.stories.tsx": require("../app/components/atomic/galoy-warning/galoy-warning.stories.tsx"),
    "./app/components/balance-header/balance-header.stories.tsx": require("../app/components/balance-header/balance-header.stories.tsx"),
    "./app/components/currency-keyboard/currency-keyboard.stories.tsx": require("../app/components/currency-keyboard/currency-keyboard.stories.tsx"),
    "./app/components/custom-modal/custom-modal.stories.tsx": require("../app/components/custom-modal/custom-modal.stories.tsx"),
    "./app/components/large-button/large-button.stories.tsx": require("../app/components/large-button/large-button.stories.tsx"),
    "./app/components/upgrade-account-modal/upgrade-account-modal.stories.tsx": require("../app/components/upgrade-account-modal/upgrade-account-modal.stories.tsx"),
    "./app/components/wallet-overview/wallet-overview.stories.tsx": require("../app/components/wallet-overview/wallet-overview.stories.tsx"),
    "./app/components/wallet-summary/wallet-summary.stories.tsx": require("../app/components/wallet-summary/wallet-summary.stories.tsx"),
    "./app/rne-theme/colors.stories.tsx": require("../app/rne-theme/colors.stories.tsx"),
    "./app/rne-theme/text.stories.tsx": require("../app/rne-theme/text.stories.tsx"),
    "./app/rne-theme/theme.stories.tsx": require("../app/rne-theme/theme.stories.tsx"),
    "./app/screens/authentication-screen/authentication-check-screen.stories.tsx": require("../app/screens/authentication-screen/authentication-check-screen.stories.tsx"),
    "./app/screens/authentication-screen/authentication-screen.stories.tsx": require("../app/screens/authentication-screen/authentication-screen.stories.tsx"),
    "./app/screens/authentication-screen/pin-screen.stories.tsx": require("../app/screens/authentication-screen/pin-screen.stories.tsx"),
    "./app/screens/contacts-screen/contacts-detail.stories.tsx": require("../app/screens/contacts-screen/contacts-detail.stories.tsx"),
    "./app/screens/contacts-screen/contacts.stories.tsx": require("../app/screens/contacts-screen/contacts.stories.tsx"),
    "./app/screens/conversion-flow/conversion-success-screen.stories.tsx": require("../app/screens/conversion-flow/conversion-success-screen.stories.tsx"),
    "./app/screens/earns-map-screen/earns-map-screen.stories.tsx": require("../app/screens/earns-map-screen/earns-map-screen.stories.tsx"),
    "./app/screens/earns-screen/earns-quiz.stories.tsx": require("../app/screens/earns-screen/earns-quiz.stories.tsx"),
    "./app/screens/earns-screen/earns-sections.stories.tsx": require("../app/screens/earns-screen/earns-sections.stories.tsx"),
    "./app/screens/earns-screen/section-completed.stories.tsx": require("../app/screens/earns-screen/section-completed.stories.tsx"),
    "./app/screens/galoy-address-screen/address-screen.stories.tsx": require("../app/screens/galoy-address-screen/address-screen.stories.tsx"),
    "./app/screens/get-started-screen/device-account-fail-modal.stories.tsx": require("../app/screens/get-started-screen/device-account-fail-modal.stories.tsx"),
    "./app/screens/get-started-screen/get-started-screen.stories.tsx": require("../app/screens/get-started-screen/get-started-screen.stories.tsx"),
    "./app/screens/home-screen/home-screen.stories.tsx": require("../app/screens/home-screen/home-screen.stories.tsx"),
    "./app/screens/phone-auth-screen/phone-flow.stories.tsx": require("../app/screens/phone-auth-screen/phone-flow.stories.tsx"),
    "./app/screens/phone-auth-screen/phone-validation.stories.tsx": require("../app/screens/phone-auth-screen/phone-validation.stories.tsx"),
    "./app/screens/receive-bitcoin-screen/receive-wrapper.stories.tsx": require("../app/screens/receive-bitcoin-screen/receive-wrapper.stories.tsx"),
    "./app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-detail-screen.stories.tsx": require("../app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-detail-screen.stories.tsx"),
    "./app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-result-screen.stories.tsx": require("../app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-result-screen.stories.tsx"),
    "./app/screens/send-bitcoin-screen/confirm-destination-modal.stories.tsx": require("../app/screens/send-bitcoin-screen/confirm-destination-modal.stories.tsx"),
    "./app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.stories.tsx": require("../app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.stories.tsx"),
    "./app/screens/send-bitcoin-screen/send-bitcoin-details-extra-info.stories.tsx": require("../app/screens/send-bitcoin-screen/send-bitcoin-details-extra-info.stories.tsx"),
    "./app/screens/send-bitcoin-screen/send-bitcoin-details-screen.stories.tsx": require("../app/screens/send-bitcoin-screen/send-bitcoin-details-screen.stories.tsx"),
    "./app/screens/send-bitcoin-screen/send-bitcoin-success-screen.stories.tsx": require("../app/screens/send-bitcoin-screen/send-bitcoin-success-screen.stories.tsx"),
    "./app/screens/settings-screen/default-wallet.stories.tsx": require("../app/screens/settings-screen/default-wallet.stories.tsx"),
    "./app/screens/settings-screen/display-currency-screen.stories.tsx": require("../app/screens/settings-screen/display-currency-screen.stories.tsx"),
    "./app/screens/settings-screen/language-screen.stories.tsx": require("../app/screens/settings-screen/language-screen.stories.tsx"),
    "./app/screens/settings-screen/settings-screen.stories.tsx": require("../app/screens/settings-screen/settings-screen.stories.tsx"),
    "./app/screens/transaction-detail-screen/transaction-detail-screen.stories.tsx": require("../app/screens/transaction-detail-screen/transaction-detail-screen.stories.tsx"),
  };
};

configure(getStories, module, false);
