import * as React from "react";
import { APPROXIMATE_PREFIX } from "@app/config";
import { useI18nContext } from "@app/i18n/i18n-react";
import { WalletCurrency } from "@app/graphql/generated";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { DisplayCurrency, isNonZeroMoneyAmount, } from "@app/types/amounts";
import { testProps } from "@app/utils/testProps";
import { AmountInputButton } from "./amount-input-button";
import { AmountInputModal } from "./amount-input-modal";
export var AmountInput = function (_a) {
    var unitOfAccountAmount = _a.unitOfAccountAmount, walletCurrency = _a.walletCurrency, setAmount = _a.setAmount, maxAmount = _a.maxAmount, minAmount = _a.minAmount, convertMoneyAmount = _a.convertMoneyAmount, _b = _a.canSetAmount, canSetAmount = _b === void 0 ? true : _b, _c = _a.isSendingMax, isSendingMax = _c === void 0 ? false : _c, _d = _a.showValuesIfDisabled, showValuesIfDisabled = _d === void 0 ? true : _d, _e = _a.big, big = _e === void 0 ? true : _e;
    var _f = React.useState(false), isSettingAmount = _f[0], setIsSettingAmount = _f[1];
    var _g = useDisplayCurrency(), formatMoneyAmount = _g.formatMoneyAmount, getSecondaryAmountIfCurrencyIsDifferent = _g.getSecondaryAmountIfCurrencyIsDifferent;
    var LL = useI18nContext().LL;
    var onSetAmount = function (amount) {
        setAmount && setAmount(amount);
        setIsSettingAmount(false);
    };
    if (isSettingAmount) {
        return (<AmountInputModal moneyAmount={unitOfAccountAmount} isOpen={true} walletCurrency={walletCurrency} convertMoneyAmount={convertMoneyAmount} onSetAmount={onSetAmount} maxAmount={maxAmount} minAmount={minAmount} close={function () { return setIsSettingAmount(false); }}/>);
    }
    var formattedPrimaryAmount = undefined;
    var formattedSecondaryAmount = undefined;
    if (isNonZeroMoneyAmount(unitOfAccountAmount)) {
        var isBtcDenominatedUsdWalletAmount = walletCurrency === WalletCurrency.Usd &&
            unitOfAccountAmount.currency === WalletCurrency.Btc;
        var primaryAmount = convertMoneyAmount(unitOfAccountAmount, DisplayCurrency);
        formattedPrimaryAmount = formatMoneyAmount({
            moneyAmount: primaryAmount,
        });
        var secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
            primaryAmount: primaryAmount,
            walletAmount: convertMoneyAmount(unitOfAccountAmount, walletCurrency),
            displayAmount: convertMoneyAmount(unitOfAccountAmount, DisplayCurrency),
        });
        formattedPrimaryAmount = formatMoneyAmount({
            moneyAmount: primaryAmount,
            isApproximate: isBtcDenominatedUsdWalletAmount && !secondaryAmount,
        });
        formattedSecondaryAmount =
            secondaryAmount &&
                formatMoneyAmount({
                    moneyAmount: secondaryAmount,
                    isApproximate: isBtcDenominatedUsdWalletAmount &&
                        secondaryAmount.currency === WalletCurrency.Usd,
                });
    }
    if (isSendingMax && formattedPrimaryAmount)
        formattedPrimaryAmount = "".concat(APPROXIMATE_PREFIX, " ").concat(formattedPrimaryAmount, " (").concat(LL.SendBitcoinScreen.max(), ")");
    var onPressInputButton = function () {
        setIsSettingAmount(true);
    };
    if (canSetAmount) {
        return (<AmountInputButton placeholder={LL.AmountInputButton.tapToSetAmount()} onPress={onPressInputButton} value={formattedPrimaryAmount} iconName="pencil" secondaryValue={formattedSecondaryAmount} primaryTextTestProps={"Amount Input Button Amount"} big={big} {...testProps("Amount Input Button")}/>);
    }
    return (<AmountInputButton placeholder={LL.AmountInputButton.tapToSetAmount()} iconName="pencil" value={formattedPrimaryAmount} secondaryValue={formattedSecondaryAmount} disabled={true} primaryTextTestProps={"Amount Input Button Amount"} showValuesIfDisabled={showValuesIfDisabled} big={big} {...testProps("Amount Input Button")}/>);
};
//# sourceMappingURL=amount-input.js.map