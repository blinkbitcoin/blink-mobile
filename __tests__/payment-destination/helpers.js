import { WalletCurrency } from "@app/graphql/generated";
export var defaultPaymentDetailParams = {
    convertMoneyAmount: jest.fn(),
    sendingWalletDescriptor: {
        currency: WalletCurrency.Btc,
        id: "testid",
    },
};
//# sourceMappingURL=helpers.js.map