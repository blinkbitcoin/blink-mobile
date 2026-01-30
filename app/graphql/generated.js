var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
var defaultOptions = {};
export var AccountLevel = {
    One: 'ONE',
    Three: 'THREE',
    Two: 'TWO',
    Zero: 'ZERO'
};
export var ApplicationStatus = {
    Approved: 'APPROVED',
    Canceled: 'CANCELED',
    Denied: 'DENIED',
    Locked: 'LOCKED',
    ManualReview: 'MANUAL_REVIEW',
    NeedsInformation: 'NEEDS_INFORMATION',
    NeedsVerification: 'NEEDS_VERIFICATION',
    NotStarted: 'NOT_STARTED',
    Pending: 'PENDING'
};
export var CardStatus = {
    Active: 'ACTIVE',
    Canceled: 'CANCELED',
    Failed: 'FAILED',
    Locked: 'LOCKED',
    NotActivated: 'NOT_ACTIVATED',
    Requested: 'REQUESTED'
};
export var CardType = {
    Physical: 'PHYSICAL',
    Virtual: 'VIRTUAL'
};
export var ContactType = {
    Intraledger: 'INTRALEDGER',
    Lnaddress: 'LNADDRESS'
};
export var ExchangeCurrencyUnit = {
    Btcsat: 'BTCSAT',
    Usdcent: 'USDCENT'
};
export var Icon = {
    ArrowLeft: 'ARROW_LEFT',
    ArrowRight: 'ARROW_RIGHT',
    BackSpace: 'BACK_SPACE',
    Bank: 'BANK',
    Bell: 'BELL',
    Bitcoin: 'BITCOIN',
    Book: 'BOOK',
    BtcBook: 'BTC_BOOK',
    CaretDown: 'CARET_DOWN',
    CaretLeft: 'CARET_LEFT',
    CaretRight: 'CARET_RIGHT',
    CaretUp: 'CARET_UP',
    Check: 'CHECK',
    CheckCircle: 'CHECK_CIRCLE',
    Close: 'CLOSE',
    CloseCrossWithBackground: 'CLOSE_CROSS_WITH_BACKGROUND',
    Coins: 'COINS',
    CopyPaste: 'COPY_PASTE',
    Dollar: 'DOLLAR',
    Eye: 'EYE',
    EyeSlash: 'EYE_SLASH',
    Filter: 'FILTER',
    Globe: 'GLOBE',
    Graph: 'GRAPH',
    Image: 'IMAGE',
    Info: 'INFO',
    Lightning: 'LIGHTNING',
    Link: 'LINK',
    Loading: 'LOADING',
    MagnifyingGlass: 'MAGNIFYING_GLASS',
    Map: 'MAP',
    Menu: 'MENU',
    Note: 'NOTE',
    PaymentError: 'PAYMENT_ERROR',
    PaymentPending: 'PAYMENT_PENDING',
    PaymentSuccess: 'PAYMENT_SUCCESS',
    Pencil: 'PENCIL',
    People: 'PEOPLE',
    QrCode: 'QR_CODE',
    Question: 'QUESTION',
    Rank: 'RANK',
    Receive: 'RECEIVE',
    Refresh: 'REFRESH',
    Send: 'SEND',
    Settings: 'SETTINGS',
    Share: 'SHARE',
    Transfer: 'TRANSFER',
    User: 'USER',
    Video: 'VIDEO',
    Warning: 'WARNING',
    WarningWithBackground: 'WARNING_WITH_BACKGROUND'
};
export var InvoicePaymentStatus = {
    Expired: 'EXPIRED',
    Paid: 'PAID',
    Pending: 'PENDING'
};
export var Network = {
    Mainnet: 'mainnet',
    Regtest: 'regtest',
    Signet: 'signet',
    Testnet: 'testnet'
};
export var NotificationChannel = {
    Push: 'PUSH'
};
export var OnboardingStatus = {
    Abandoned: 'ABANDONED',
    Approved: 'APPROVED',
    AwaitingInput: 'AWAITING_INPUT',
    Declined: 'DECLINED',
    Error: 'ERROR',
    NotStarted: 'NOT_STARTED',
    Processing: 'PROCESSING',
    Review: 'REVIEW'
};
export var PaymentSendResult = {
    AlreadyPaid: 'ALREADY_PAID',
    Failure: 'FAILURE',
    Pending: 'PENDING',
    Success: 'SUCCESS'
};
export var PayoutSpeed = {
    Fast: 'FAST',
    Medium: 'MEDIUM',
    Slow: 'SLOW'
};
export var PhoneCodeChannelType = {
    Sms: 'SMS',
    Telegram: 'TELEGRAM',
    Whatsapp: 'WHATSAPP'
};
/** The range for the X axis in the BTC price graph */
export var PriceGraphRange = {
    FiveYears: 'FIVE_YEARS',
    OneDay: 'ONE_DAY',
    OneMonth: 'ONE_MONTH',
    OneWeek: 'ONE_WEEK',
    OneYear: 'ONE_YEAR'
};
export var Scope = {
    Read: 'READ',
    Receive: 'RECEIVE',
    Write: 'WRITE'
};
export var SupportRole = {
    Assistant: 'ASSISTANT',
    User: 'USER'
};
export var TransactionStatus = {
    Completed: 'COMPLETED',
    Declined: 'DECLINED',
    Pending: 'PENDING',
    Reversed: 'REVERSED'
};
export var TxDirection = {
    Receive: 'RECEIVE',
    Send: 'SEND'
};
export var TxNotificationType = {
    IntraLedgerPayment: 'IntraLedgerPayment',
    IntraLedgerReceipt: 'IntraLedgerReceipt',
    LigtningReceipt: 'LigtningReceipt',
    OnchainPayment: 'OnchainPayment',
    OnchainReceipt: 'OnchainReceipt',
    OnchainReceiptPending: 'OnchainReceiptPending'
};
export var TxStatus = {
    Failure: 'FAILURE',
    Pending: 'PENDING',
    Success: 'SUCCESS'
};
export var WalletCurrency = {
    Btc: 'BTC',
    Usd: 'USD'
};
export var WelcomeRange = {
    AllTime: 'AllTime',
    ThisMonth: 'ThisMonth'
};
export var TransactionFragmentDoc = gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    fragment Transaction on Transaction {\n  __typename\n  id\n  status\n  direction\n  memo\n  createdAt\n  settlementAmount\n  settlementFee\n  settlementDisplayFee\n  settlementCurrency\n  settlementDisplayAmount\n  settlementDisplayCurrency\n  settlementPrice {\n    base\n    offset\n    currencyUnit\n    formattedAmount\n  }\n  initiationVia {\n    ... on InitiationViaIntraLedger {\n      counterPartyWalletId\n      counterPartyUsername\n    }\n    ... on InitiationViaLn {\n      paymentHash\n      paymentRequest\n    }\n    ... on InitiationViaOnChain {\n      address\n    }\n  }\n  settlementVia {\n    ... on SettlementViaIntraLedger {\n      counterPartyWalletId\n      counterPartyUsername\n      preImage\n    }\n    ... on SettlementViaLn {\n      preImage\n    }\n    ... on SettlementViaOnChain {\n      transactionHash\n      arrivalInMempoolEstimatedAt\n    }\n  }\n}\n    "], ["\n    fragment Transaction on Transaction {\n  __typename\n  id\n  status\n  direction\n  memo\n  createdAt\n  settlementAmount\n  settlementFee\n  settlementDisplayFee\n  settlementCurrency\n  settlementDisplayAmount\n  settlementDisplayCurrency\n  settlementPrice {\n    base\n    offset\n    currencyUnit\n    formattedAmount\n  }\n  initiationVia {\n    ... on InitiationViaIntraLedger {\n      counterPartyWalletId\n      counterPartyUsername\n    }\n    ... on InitiationViaLn {\n      paymentHash\n      paymentRequest\n    }\n    ... on InitiationViaOnChain {\n      address\n    }\n  }\n  settlementVia {\n    ... on SettlementViaIntraLedger {\n      counterPartyWalletId\n      counterPartyUsername\n      preImage\n    }\n    ... on SettlementViaLn {\n      preImage\n    }\n    ... on SettlementViaOnChain {\n      transactionHash\n      arrivalInMempoolEstimatedAt\n    }\n  }\n}\n    "])));
export var TransactionListFragmentDoc = gql(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    fragment TransactionList on TransactionConnection {\n  pageInfo {\n    hasNextPage\n    hasPreviousPage\n    startCursor\n    endCursor\n  }\n  edges {\n    cursor\n    node {\n      ...Transaction\n    }\n  }\n}\n    ", ""], ["\n    fragment TransactionList on TransactionConnection {\n  pageInfo {\n    hasNextPage\n    hasPreviousPage\n    startCursor\n    endCursor\n  }\n  edges {\n    cursor\n    node {\n      ...Transaction\n    }\n  }\n}\n    ", ""])), TransactionFragmentDoc);
export var MobileUpdateDocument = gql(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    query mobileUpdate {\n  mobileVersions {\n    platform\n    currentSupported\n    minSupported\n  }\n}\n    "], ["\n    query mobileUpdate {\n  mobileVersions {\n    platform\n    currentSupported\n    minSupported\n  }\n}\n    "])));
/**
 * __useMobileUpdateQuery__
 *
 * To run a query within a React component, call `useMobileUpdateQuery` and pass it any options that fit your needs.
 * When your component renders, `useMobileUpdateQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMobileUpdateQuery({
 *   variables: {
 *   },
 * });
 */
export function useMobileUpdateQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(MobileUpdateDocument, options);
}
export function useMobileUpdateLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(MobileUpdateDocument, options);
}
export function useMobileUpdateSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(MobileUpdateDocument, options);
}
export var InviteDocument = gql(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    query invite {\n  me {\n    id\n    username\n  }\n}\n    "], ["\n    query invite {\n  me {\n    id\n    username\n  }\n}\n    "])));
/**
 * __useInviteQuery__
 *
 * To run a query within a React component, call `useInviteQuery` and pass it any options that fit your needs.
 * When your component renders, `useInviteQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useInviteQuery({
 *   variables: {
 *   },
 * });
 */
export function useInviteQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(InviteDocument, options);
}
export function useInviteLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(InviteDocument, options);
}
export function useInviteSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(InviteDocument, options);
}
export var BtcPriceListDocument = gql(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    query btcPriceList($range: PriceGraphRange!) {\n  btcPriceList(range: $range) {\n    timestamp\n    price {\n      base\n      offset\n      currencyUnit\n    }\n  }\n}\n    "], ["\n    query btcPriceList($range: PriceGraphRange!) {\n  btcPriceList(range: $range) {\n    timestamp\n    price {\n      base\n      offset\n      currencyUnit\n    }\n  }\n}\n    "])));
/**
 * __useBtcPriceListQuery__
 *
 * To run a query within a React component, call `useBtcPriceListQuery` and pass it any options that fit your needs.
 * When your component renders, `useBtcPriceListQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBtcPriceListQuery({
 *   variables: {
 *      range: // value for 'range'
 *   },
 * });
 */
export function useBtcPriceListQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(BtcPriceListDocument, options);
}
export function useBtcPriceListLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(BtcPriceListDocument, options);
}
export function useBtcPriceListSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(BtcPriceListDocument, options);
}
export var SetDefaultAccountModalDocument = gql(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    query setDefaultAccountModal {\n  me {\n    id\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "], ["\n    query setDefaultAccountModal {\n  me {\n    id\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "])));
/**
 * __useSetDefaultAccountModalQuery__
 *
 * To run a query within a React component, call `useSetDefaultAccountModalQuery` and pass it any options that fit your needs.
 * When your component renders, `useSetDefaultAccountModalQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSetDefaultAccountModalQuery({
 *   variables: {
 *   },
 * });
 */
export function useSetDefaultAccountModalQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SetDefaultAccountModalDocument, options);
}
export function useSetDefaultAccountModalLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SetDefaultAccountModalDocument, options);
}
export function useSetDefaultAccountModalSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SetDefaultAccountModalDocument, options);
}
export var UserUpdateUsernameDocument = gql(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    mutation userUpdateUsername($input: UserUpdateUsernameInput!) {\n  userUpdateUsername(input: $input) {\n    errors {\n      code\n    }\n    user {\n      id\n      username\n    }\n  }\n}\n    "], ["\n    mutation userUpdateUsername($input: UserUpdateUsernameInput!) {\n  userUpdateUsername(input: $input) {\n    errors {\n      code\n    }\n    user {\n      id\n      username\n    }\n  }\n}\n    "])));
/**
 * __useUserUpdateUsernameMutation__
 *
 * To run a mutation, you first call `useUserUpdateUsernameMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserUpdateUsernameMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userUpdateUsernameMutation, { data, loading, error }] = useUserUpdateUsernameMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserUpdateUsernameMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserUpdateUsernameDocument, options);
}
export var MyUserIdDocument = gql(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    query myUserId {\n  me {\n    id\n  }\n}\n    "], ["\n    query myUserId {\n  me {\n    id\n  }\n}\n    "])));
/**
 * __useMyUserIdQuery__
 *
 * To run a query within a React component, call `useMyUserIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useMyUserIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMyUserIdQuery({
 *   variables: {
 *   },
 * });
 */
export function useMyUserIdQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(MyUserIdDocument, options);
}
export function useMyUserIdLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(MyUserIdDocument, options);
}
export function useMyUserIdSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(MyUserIdDocument, options);
}
export var WalletOverviewScreenDocument = gql(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    query walletOverviewScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "], ["\n    query walletOverviewScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "])));
/**
 * __useWalletOverviewScreenQuery__
 *
 * To run a query within a React component, call `useWalletOverviewScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useWalletOverviewScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useWalletOverviewScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useWalletOverviewScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(WalletOverviewScreenDocument, options);
}
export function useWalletOverviewScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(WalletOverviewScreenDocument, options);
}
export function useWalletOverviewScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(WalletOverviewScreenDocument, options);
}
export var AnalyticsDocument = gql(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    query analytics {\n  me {\n    username\n    id\n  }\n  globals {\n    network\n  }\n}\n    "], ["\n    query analytics {\n  me {\n    username\n    id\n  }\n  globals {\n    network\n  }\n}\n    "])));
/**
 * __useAnalyticsQuery__
 *
 * To run a query within a React component, call `useAnalyticsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAnalyticsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAnalyticsQuery({
 *   variables: {
 *   },
 * });
 */
export function useAnalyticsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(AnalyticsDocument, options);
}
export function useAnalyticsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(AnalyticsDocument, options);
}
export function useAnalyticsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(AnalyticsDocument, options);
}
export var RealtimePriceDocument = gql(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n    query realtimePrice {\n  me {\n    id\n    defaultAccount {\n      id\n      realtimePrice {\n        btcSatPrice {\n          base\n          offset\n        }\n        denominatorCurrency\n        id\n        timestamp\n        usdCentPrice {\n          base\n          offset\n        }\n      }\n    }\n  }\n}\n    "], ["\n    query realtimePrice {\n  me {\n    id\n    defaultAccount {\n      id\n      realtimePrice {\n        btcSatPrice {\n          base\n          offset\n        }\n        denominatorCurrency\n        id\n        timestamp\n        usdCentPrice {\n          base\n          offset\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useRealtimePriceQuery__
 *
 * To run a query within a React component, call `useRealtimePriceQuery` and pass it any options that fit your needs.
 * When your component renders, `useRealtimePriceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRealtimePriceQuery({
 *   variables: {
 *   },
 * });
 */
export function useRealtimePriceQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(RealtimePriceDocument, options);
}
export function useRealtimePriceLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(RealtimePriceDocument, options);
}
export function useRealtimePriceSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(RealtimePriceDocument, options);
}
export var HideBalanceDocument = gql(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n    query hideBalance {\n  hideBalance @client\n}\n    "], ["\n    query hideBalance {\n  hideBalance @client\n}\n    "])));
/**
 * __useHideBalanceQuery__
 *
 * To run a query within a React component, call `useHideBalanceQuery` and pass it any options that fit your needs.
 * When your component renders, `useHideBalanceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHideBalanceQuery({
 *   variables: {
 *   },
 * });
 */
export function useHideBalanceQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(HideBalanceDocument, options);
}
export function useHideBalanceLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(HideBalanceDocument, options);
}
export function useHideBalanceSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(HideBalanceDocument, options);
}
export var HiddenBalanceToolTipDocument = gql(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\n    query hiddenBalanceToolTip {\n  hiddenBalanceToolTip @client\n}\n    "], ["\n    query hiddenBalanceToolTip {\n  hiddenBalanceToolTip @client\n}\n    "])));
/**
 * __useHiddenBalanceToolTipQuery__
 *
 * To run a query within a React component, call `useHiddenBalanceToolTipQuery` and pass it any options that fit your needs.
 * When your component renders, `useHiddenBalanceToolTipQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHiddenBalanceToolTipQuery({
 *   variables: {
 *   },
 * });
 */
export function useHiddenBalanceToolTipQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(HiddenBalanceToolTipDocument, options);
}
export function useHiddenBalanceToolTipLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(HiddenBalanceToolTipDocument, options);
}
export function useHiddenBalanceToolTipSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(HiddenBalanceToolTipDocument, options);
}
export var BetaDocument = gql(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\n    query beta {\n  beta @client\n}\n    "], ["\n    query beta {\n  beta @client\n}\n    "])));
/**
 * __useBetaQuery__
 *
 * To run a query within a React component, call `useBetaQuery` and pass it any options that fit your needs.
 * When your component renders, `useBetaQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBetaQuery({
 *   variables: {
 *   },
 * });
 */
export function useBetaQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(BetaDocument, options);
}
export function useBetaLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(BetaDocument, options);
}
export function useBetaSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(BetaDocument, options);
}
export var ColorSchemeDocument = gql(templateObject_15 || (templateObject_15 = __makeTemplateObject(["\n    query colorScheme {\n  colorScheme @client\n}\n    "], ["\n    query colorScheme {\n  colorScheme @client\n}\n    "])));
/**
 * __useColorSchemeQuery__
 *
 * To run a query within a React component, call `useColorSchemeQuery` and pass it any options that fit your needs.
 * When your component renders, `useColorSchemeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useColorSchemeQuery({
 *   variables: {
 *   },
 * });
 */
export function useColorSchemeQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(ColorSchemeDocument, options);
}
export function useColorSchemeLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(ColorSchemeDocument, options);
}
export function useColorSchemeSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(ColorSchemeDocument, options);
}
export var CountryCodeDocument = gql(templateObject_16 || (templateObject_16 = __makeTemplateObject(["\n    query countryCode {\n  countryCode @client\n}\n    "], ["\n    query countryCode {\n  countryCode @client\n}\n    "])));
/**
 * __useCountryCodeQuery__
 *
 * To run a query within a React component, call `useCountryCodeQuery` and pass it any options that fit your needs.
 * When your component renders, `useCountryCodeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCountryCodeQuery({
 *   variables: {
 *   },
 * });
 */
export function useCountryCodeQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(CountryCodeDocument, options);
}
export function useCountryCodeLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(CountryCodeDocument, options);
}
export function useCountryCodeSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(CountryCodeDocument, options);
}
export var RegionDocument = gql(templateObject_17 || (templateObject_17 = __makeTemplateObject(["\n    query region {\n  region @client {\n    latitude\n    longitude\n    latitudeDelta\n    longitudeDelta\n  }\n}\n    "], ["\n    query region {\n  region @client {\n    latitude\n    longitude\n    latitudeDelta\n    longitudeDelta\n  }\n}\n    "])));
/**
 * __useRegionQuery__
 *
 * To run a query within a React component, call `useRegionQuery` and pass it any options that fit your needs.
 * When your component renders, `useRegionQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRegionQuery({
 *   variables: {
 *   },
 * });
 */
export function useRegionQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(RegionDocument, options);
}
export function useRegionLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(RegionDocument, options);
}
export function useRegionSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(RegionDocument, options);
}
export var FeedbackModalShownDocument = gql(templateObject_18 || (templateObject_18 = __makeTemplateObject(["\n    query feedbackModalShown {\n  feedbackModalShown @client\n}\n    "], ["\n    query feedbackModalShown {\n  feedbackModalShown @client\n}\n    "])));
/**
 * __useFeedbackModalShownQuery__
 *
 * To run a query within a React component, call `useFeedbackModalShownQuery` and pass it any options that fit your needs.
 * When your component renders, `useFeedbackModalShownQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useFeedbackModalShownQuery({
 *   variables: {
 *   },
 * });
 */
export function useFeedbackModalShownQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(FeedbackModalShownDocument, options);
}
export function useFeedbackModalShownLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(FeedbackModalShownDocument, options);
}
export function useFeedbackModalShownSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(FeedbackModalShownDocument, options);
}
export var HasPromptedSetDefaultAccountDocument = gql(templateObject_19 || (templateObject_19 = __makeTemplateObject(["\n    query hasPromptedSetDefaultAccount {\n  hasPromptedSetDefaultAccount @client\n}\n    "], ["\n    query hasPromptedSetDefaultAccount {\n  hasPromptedSetDefaultAccount @client\n}\n    "])));
/**
 * __useHasPromptedSetDefaultAccountQuery__
 *
 * To run a query within a React component, call `useHasPromptedSetDefaultAccountQuery` and pass it any options that fit your needs.
 * When your component renders, `useHasPromptedSetDefaultAccountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHasPromptedSetDefaultAccountQuery({
 *   variables: {
 *   },
 * });
 */
export function useHasPromptedSetDefaultAccountQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(HasPromptedSetDefaultAccountDocument, options);
}
export function useHasPromptedSetDefaultAccountLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(HasPromptedSetDefaultAccountDocument, options);
}
export function useHasPromptedSetDefaultAccountSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(HasPromptedSetDefaultAccountDocument, options);
}
export var IntroducingCirclesModalShownDocument = gql(templateObject_20 || (templateObject_20 = __makeTemplateObject(["\n    query introducingCirclesModalShown {\n  introducingCirclesModalShown @client\n}\n    "], ["\n    query introducingCirclesModalShown {\n  introducingCirclesModalShown @client\n}\n    "])));
/**
 * __useIntroducingCirclesModalShownQuery__
 *
 * To run a query within a React component, call `useIntroducingCirclesModalShownQuery` and pass it any options that fit your needs.
 * When your component renders, `useIntroducingCirclesModalShownQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useIntroducingCirclesModalShownQuery({
 *   variables: {
 *   },
 * });
 */
export function useIntroducingCirclesModalShownQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(IntroducingCirclesModalShownDocument, options);
}
export function useIntroducingCirclesModalShownLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(IntroducingCirclesModalShownDocument, options);
}
export function useIntroducingCirclesModalShownSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(IntroducingCirclesModalShownDocument, options);
}
export var InnerCircleValueDocument = gql(templateObject_21 || (templateObject_21 = __makeTemplateObject(["\n    query innerCircleValue {\n  innerCircleValue @client\n}\n    "], ["\n    query innerCircleValue {\n  innerCircleValue @client\n}\n    "])));
/**
 * __useInnerCircleValueQuery__
 *
 * To run a query within a React component, call `useInnerCircleValueQuery` and pass it any options that fit your needs.
 * When your component renders, `useInnerCircleValueQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useInnerCircleValueQuery({
 *   variables: {
 *   },
 * });
 */
export function useInnerCircleValueQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(InnerCircleValueDocument, options);
}
export function useInnerCircleValueLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(InnerCircleValueDocument, options);
}
export function useInnerCircleValueSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(InnerCircleValueDocument, options);
}
export var UpgradeModalLastShownAtDocument = gql(templateObject_22 || (templateObject_22 = __makeTemplateObject(["\n    query upgradeModalLastShownAt {\n  upgradeModalLastShownAt @client\n}\n    "], ["\n    query upgradeModalLastShownAt {\n  upgradeModalLastShownAt @client\n}\n    "])));
/**
 * __useUpgradeModalLastShownAtQuery__
 *
 * To run a query within a React component, call `useUpgradeModalLastShownAtQuery` and pass it any options that fit your needs.
 * When your component renders, `useUpgradeModalLastShownAtQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useUpgradeModalLastShownAtQuery({
 *   variables: {
 *   },
 * });
 */
export function useUpgradeModalLastShownAtQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(UpgradeModalLastShownAtDocument, options);
}
export function useUpgradeModalLastShownAtLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(UpgradeModalLastShownAtDocument, options);
}
export function useUpgradeModalLastShownAtSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(UpgradeModalLastShownAtDocument, options);
}
export var DeviceSessionCountDocument = gql(templateObject_23 || (templateObject_23 = __makeTemplateObject(["\n    query deviceSessionCount {\n  deviceSessionCount @client\n}\n    "], ["\n    query deviceSessionCount {\n  deviceSessionCount @client\n}\n    "])));
/**
 * __useDeviceSessionCountQuery__
 *
 * To run a query within a React component, call `useDeviceSessionCountQuery` and pass it any options that fit your needs.
 * When your component renders, `useDeviceSessionCountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDeviceSessionCountQuery({
 *   variables: {
 *   },
 * });
 */
export function useDeviceSessionCountQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(DeviceSessionCountDocument, options);
}
export function useDeviceSessionCountLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(DeviceSessionCountDocument, options);
}
export function useDeviceSessionCountSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(DeviceSessionCountDocument, options);
}
export var TxLastSeenDocument = gql(templateObject_24 || (templateObject_24 = __makeTemplateObject(["\n    query txLastSeen($accountId: ID!) {\n  txLastSeen(accountId: $accountId) @client {\n    accountId\n    btcId\n    usdId\n  }\n}\n    "], ["\n    query txLastSeen($accountId: ID!) {\n  txLastSeen(accountId: $accountId) @client {\n    accountId\n    btcId\n    usdId\n  }\n}\n    "])));
/**
 * __useTxLastSeenQuery__
 *
 * To run a query within a React component, call `useTxLastSeenQuery` and pass it any options that fit your needs.
 * When your component renders, `useTxLastSeenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTxLastSeenQuery({
 *   variables: {
 *      accountId: // value for 'accountId'
 *   },
 * });
 */
export function useTxLastSeenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(TxLastSeenDocument, options);
}
export function useTxLastSeenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(TxLastSeenDocument, options);
}
export function useTxLastSeenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(TxLastSeenDocument, options);
}
export var NetworkDocument = gql(templateObject_25 || (templateObject_25 = __makeTemplateObject(["\n    query network {\n  globals {\n    network\n  }\n}\n    "], ["\n    query network {\n  globals {\n    network\n  }\n}\n    "])));
/**
 * __useNetworkQuery__
 *
 * To run a query within a React component, call `useNetworkQuery` and pass it any options that fit your needs.
 * When your component renders, `useNetworkQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNetworkQuery({
 *   variables: {
 *   },
 * });
 */
export function useNetworkQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(NetworkDocument, options);
}
export function useNetworkLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(NetworkDocument, options);
}
export function useNetworkSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(NetworkDocument, options);
}
export var LevelDocument = gql(templateObject_26 || (templateObject_26 = __makeTemplateObject(["\n    query level {\n  me {\n    id\n    defaultAccount {\n      id\n      level\n    }\n  }\n}\n    "], ["\n    query level {\n  me {\n    id\n    defaultAccount {\n      id\n      level\n    }\n  }\n}\n    "])));
/**
 * __useLevelQuery__
 *
 * To run a query within a React component, call `useLevelQuery` and pass it any options that fit your needs.
 * When your component renders, `useLevelQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLevelQuery({
 *   variables: {
 *   },
 * });
 */
export function useLevelQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(LevelDocument, options);
}
export function useLevelLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(LevelDocument, options);
}
export function useLevelSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(LevelDocument, options);
}
export var DisplayCurrencyDocument = gql(templateObject_27 || (templateObject_27 = __makeTemplateObject(["\n    query displayCurrency {\n  me {\n    id\n    defaultAccount {\n      id\n      displayCurrency\n    }\n  }\n}\n    "], ["\n    query displayCurrency {\n  me {\n    id\n    defaultAccount {\n      id\n      displayCurrency\n    }\n  }\n}\n    "])));
/**
 * __useDisplayCurrencyQuery__
 *
 * To run a query within a React component, call `useDisplayCurrencyQuery` and pass it any options that fit your needs.
 * When your component renders, `useDisplayCurrencyQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDisplayCurrencyQuery({
 *   variables: {
 *   },
 * });
 */
export function useDisplayCurrencyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(DisplayCurrencyDocument, options);
}
export function useDisplayCurrencyLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(DisplayCurrencyDocument, options);
}
export function useDisplayCurrencySuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(DisplayCurrencyDocument, options);
}
export var CurrencyListDocument = gql(templateObject_28 || (templateObject_28 = __makeTemplateObject(["\n    query currencyList {\n  currencyList {\n    __typename\n    id\n    flag\n    name\n    symbol\n    fractionDigits\n  }\n}\n    "], ["\n    query currencyList {\n  currencyList {\n    __typename\n    id\n    flag\n    name\n    symbol\n    fractionDigits\n  }\n}\n    "])));
/**
 * __useCurrencyListQuery__
 *
 * To run a query within a React component, call `useCurrencyListQuery` and pass it any options that fit your needs.
 * When your component renders, `useCurrencyListQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCurrencyListQuery({
 *   variables: {
 *   },
 * });
 */
export function useCurrencyListQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(CurrencyListDocument, options);
}
export function useCurrencyListLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(CurrencyListDocument, options);
}
export function useCurrencyListSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(CurrencyListDocument, options);
}
export var CaptchaCreateChallengeDocument = gql(templateObject_29 || (templateObject_29 = __makeTemplateObject(["\n    mutation captchaCreateChallenge {\n  captchaCreateChallenge {\n    errors {\n      message\n    }\n    result {\n      id\n      challengeCode\n      newCaptcha\n      failbackMode\n    }\n  }\n}\n    "], ["\n    mutation captchaCreateChallenge {\n  captchaCreateChallenge {\n    errors {\n      message\n    }\n    result {\n      id\n      challengeCode\n      newCaptcha\n      failbackMode\n    }\n  }\n}\n    "])));
/**
 * __useCaptchaCreateChallengeMutation__
 *
 * To run a mutation, you first call `useCaptchaCreateChallengeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCaptchaCreateChallengeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [captchaCreateChallengeMutation, { data, loading, error }] = useCaptchaCreateChallengeMutation({
 *   variables: {
 *   },
 * });
 */
export function useCaptchaCreateChallengeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(CaptchaCreateChallengeDocument, options);
}
export var UserLogoutDocument = gql(templateObject_30 || (templateObject_30 = __makeTemplateObject(["\n    mutation userLogout($input: UserLogoutInput!) {\n  userLogout(input: $input) {\n    success\n  }\n}\n    "], ["\n    mutation userLogout($input: UserLogoutInput!) {\n  userLogout(input: $input) {\n    success\n  }\n}\n    "])));
/**
 * __useUserLogoutMutation__
 *
 * To run a mutation, you first call `useUserLogoutMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserLogoutMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userLogoutMutation, { data, loading, error }] = useUserLogoutMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserLogoutMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserLogoutDocument, options);
}
export var GetUsernamesDocument = gql(templateObject_31 || (templateObject_31 = __makeTemplateObject(["\n    query getUsernames {\n  me {\n    id\n    phone\n    username\n    defaultAccount {\n      id\n    }\n    email {\n      address\n    }\n  }\n}\n    "], ["\n    query getUsernames {\n  me {\n    id\n    phone\n    username\n    defaultAccount {\n      id\n    }\n    email {\n      address\n    }\n  }\n}\n    "])));
/**
 * __useGetUsernamesQuery__
 *
 * To run a query within a React component, call `useGetUsernamesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUsernamesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUsernamesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetUsernamesQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(GetUsernamesDocument, options);
}
export function useGetUsernamesLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(GetUsernamesDocument, options);
}
export function useGetUsernamesSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(GetUsernamesDocument, options);
}
export var ConversionScreenDocument = gql(templateObject_32 || (templateObject_32 = __makeTemplateObject(["\n    query conversionScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "], ["\n    query conversionScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "])));
/**
 * __useConversionScreenQuery__
 *
 * To run a query within a React component, call `useConversionScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useConversionScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useConversionScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useConversionScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(ConversionScreenDocument, options);
}
export function useConversionScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(ConversionScreenDocument, options);
}
export function useConversionScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(ConversionScreenDocument, options);
}
export var DebugScreenDocument = gql(templateObject_33 || (templateObject_33 = __makeTemplateObject(["\n    query debugScreen {\n  me {\n    id\n    defaultAccount {\n      id\n    }\n  }\n}\n    "], ["\n    query debugScreen {\n  me {\n    id\n    defaultAccount {\n      id\n    }\n  }\n}\n    "])));
/**
 * __useDebugScreenQuery__
 *
 * To run a query within a React component, call `useDebugScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useDebugScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDebugScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useDebugScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(DebugScreenDocument, options);
}
export function useDebugScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(DebugScreenDocument, options);
}
export function useDebugScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(DebugScreenDocument, options);
}
export var MyQuizQuestionsDocument = gql(templateObject_34 || (templateObject_34 = __makeTemplateObject(["\n    query myQuizQuestions {\n  me {\n    id\n    defaultAccount {\n      id\n      ... on ConsumerAccount {\n        quiz {\n          id\n          amount\n          completed\n          notBefore\n        }\n      }\n    }\n  }\n}\n    "], ["\n    query myQuizQuestions {\n  me {\n    id\n    defaultAccount {\n      id\n      ... on ConsumerAccount {\n        quiz {\n          id\n          amount\n          completed\n          notBefore\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useMyQuizQuestionsQuery__
 *
 * To run a query within a React component, call `useMyQuizQuestionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useMyQuizQuestionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMyQuizQuestionsQuery({
 *   variables: {
 *   },
 * });
 */
export function useMyQuizQuestionsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(MyQuizQuestionsDocument, options);
}
export function useMyQuizQuestionsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(MyQuizQuestionsDocument, options);
}
export function useMyQuizQuestionsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(MyQuizQuestionsDocument, options);
}
export var QuizClaimDocument = gql(templateObject_35 || (templateObject_35 = __makeTemplateObject(["\n    mutation quizClaim($input: QuizClaimInput!) {\n  quizClaim(input: $input) {\n    errors {\n      message\n      code\n    }\n    quizzes {\n      id\n      amount\n      completed\n      notBefore\n    }\n  }\n}\n    "], ["\n    mutation quizClaim($input: QuizClaimInput!) {\n  quizClaim(input: $input) {\n    errors {\n      message\n      code\n    }\n    quizzes {\n      id\n      amount\n      completed\n      notBefore\n    }\n  }\n}\n    "])));
/**
 * __useQuizClaimMutation__
 *
 * To run a mutation, you first call `useQuizClaimMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useQuizClaimMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [quizClaimMutation, { data, loading, error }] = useQuizClaimMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useQuizClaimMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(QuizClaimDocument, options);
}
export var UserEmailRegistrationInitiateDocument = gql(templateObject_36 || (templateObject_36 = __makeTemplateObject(["\n    mutation userEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {\n  userEmailRegistrationInitiate(input: $input) {\n    errors {\n      message\n    }\n    emailRegistrationId\n    me {\n      id\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "], ["\n    mutation userEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {\n  userEmailRegistrationInitiate(input: $input) {\n    errors {\n      message\n    }\n    emailRegistrationId\n    me {\n      id\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "])));
/**
 * __useUserEmailRegistrationInitiateMutation__
 *
 * To run a mutation, you first call `useUserEmailRegistrationInitiateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserEmailRegistrationInitiateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userEmailRegistrationInitiateMutation, { data, loading, error }] = useUserEmailRegistrationInitiateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserEmailRegistrationInitiateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserEmailRegistrationInitiateDocument, options);
}
export var UserEmailRegistrationValidateDocument = gql(templateObject_37 || (templateObject_37 = __makeTemplateObject(["\n    mutation userEmailRegistrationValidate($input: UserEmailRegistrationValidateInput!) {\n  userEmailRegistrationValidate(input: $input) {\n    errors {\n      message\n    }\n    me {\n      id\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "], ["\n    mutation userEmailRegistrationValidate($input: UserEmailRegistrationValidateInput!) {\n  userEmailRegistrationValidate(input: $input) {\n    errors {\n      message\n    }\n    me {\n      id\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "])));
/**
 * __useUserEmailRegistrationValidateMutation__
 *
 * To run a mutation, you first call `useUserEmailRegistrationValidateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserEmailRegistrationValidateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userEmailRegistrationValidateMutation, { data, loading, error }] = useUserEmailRegistrationValidateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserEmailRegistrationValidateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserEmailRegistrationValidateDocument, options);
}
export var KycFlowStartDocument = gql(templateObject_38 || (templateObject_38 = __makeTemplateObject(["\n    mutation kycFlowStart($input: KycFlowStartInput!) {\n  kycFlowStart(input: $input) {\n    workflowRunId\n    tokenWeb\n  }\n}\n    "], ["\n    mutation kycFlowStart($input: KycFlowStartInput!) {\n  kycFlowStart(input: $input) {\n    workflowRunId\n    tokenWeb\n  }\n}\n    "])));
/**
 * __useKycFlowStartMutation__
 *
 * To run a mutation, you first call `useKycFlowStartMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useKycFlowStartMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [kycFlowStartMutation, { data, loading, error }] = useKycFlowStartMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useKycFlowStartMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(KycFlowStartDocument, options);
}
export var FullOnboardingScreenDocument = gql(templateObject_39 || (templateObject_39 = __makeTemplateObject(["\n    query fullOnboardingScreen {\n  me {\n    id\n    defaultAccount {\n      ... on ConsumerAccount {\n        id\n        onboardingStatus\n      }\n    }\n  }\n}\n    "], ["\n    query fullOnboardingScreen {\n  me {\n    id\n    defaultAccount {\n      ... on ConsumerAccount {\n        id\n        onboardingStatus\n      }\n    }\n  }\n}\n    "])));
/**
 * __useFullOnboardingScreenQuery__
 *
 * To run a query within a React component, call `useFullOnboardingScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useFullOnboardingScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useFullOnboardingScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useFullOnboardingScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(FullOnboardingScreenDocument, options);
}
export function useFullOnboardingScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(FullOnboardingScreenDocument, options);
}
export function useFullOnboardingScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(FullOnboardingScreenDocument, options);
}
export var AddressScreenDocument = gql(templateObject_40 || (templateObject_40 = __makeTemplateObject(["\n    query addressScreen {\n  me {\n    id\n    username\n  }\n}\n    "], ["\n    query addressScreen {\n  me {\n    id\n    username\n  }\n}\n    "])));
/**
 * __useAddressScreenQuery__
 *
 * To run a query within a React component, call `useAddressScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useAddressScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAddressScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useAddressScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(AddressScreenDocument, options);
}
export function useAddressScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(AddressScreenDocument, options);
}
export function useAddressScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(AddressScreenDocument, options);
}
export var HomeAuthedDocument = gql(templateObject_41 || (templateObject_41 = __makeTemplateObject(["\n    query homeAuthed {\n  me {\n    id\n    language\n    username\n    phone\n    email {\n      address\n      verified\n    }\n    defaultAccount {\n      id\n      level\n      defaultWalletId\n      pendingIncomingTransactions {\n        ...Transaction\n      }\n      transactions(first: 20) {\n        ...TransactionList\n      }\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    ", "\n", ""], ["\n    query homeAuthed {\n  me {\n    id\n    language\n    username\n    phone\n    email {\n      address\n      verified\n    }\n    defaultAccount {\n      id\n      level\n      defaultWalletId\n      pendingIncomingTransactions {\n        ...Transaction\n      }\n      transactions(first: 20) {\n        ...TransactionList\n      }\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    ", "\n", ""])), TransactionFragmentDoc, TransactionListFragmentDoc);
/**
 * __useHomeAuthedQuery__
 *
 * To run a query within a React component, call `useHomeAuthedQuery` and pass it any options that fit your needs.
 * When your component renders, `useHomeAuthedQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHomeAuthedQuery({
 *   variables: {
 *   },
 * });
 */
export function useHomeAuthedQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(HomeAuthedDocument, options);
}
export function useHomeAuthedLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(HomeAuthedDocument, options);
}
export function useHomeAuthedSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(HomeAuthedDocument, options);
}
export var HomeUnauthedDocument = gql(templateObject_42 || (templateObject_42 = __makeTemplateObject(["\n    query homeUnauthed {\n  globals {\n    network\n  }\n  currencyList {\n    id\n    flag\n    name\n    symbol\n    fractionDigits\n  }\n}\n    "], ["\n    query homeUnauthed {\n  globals {\n    network\n  }\n  currencyList {\n    id\n    flag\n    name\n    symbol\n    fractionDigits\n  }\n}\n    "])));
/**
 * __useHomeUnauthedQuery__
 *
 * To run a query within a React component, call `useHomeUnauthedQuery` and pass it any options that fit your needs.
 * When your component renders, `useHomeUnauthedQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHomeUnauthedQuery({
 *   variables: {
 *   },
 * });
 */
export function useHomeUnauthedQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(HomeUnauthedDocument, options);
}
export function useHomeUnauthedLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(HomeUnauthedDocument, options);
}
export function useHomeUnauthedSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(HomeUnauthedDocument, options);
}
export var BulletinsDocument = gql(templateObject_43 || (templateObject_43 = __makeTemplateObject(["\n    query Bulletins($first: Int!, $after: String) {\n  me {\n    id\n    unacknowledgedStatefulNotificationsWithBulletinEnabled(\n      first: $first\n      after: $after\n    ) {\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n      edges {\n        node {\n          id\n          title\n          body\n          createdAt\n          acknowledgedAt\n          bulletinEnabled\n          icon\n          action {\n            ... on OpenDeepLinkAction {\n              deepLink\n            }\n            ... on OpenExternalLinkAction {\n              url\n            }\n          }\n        }\n        cursor\n      }\n    }\n  }\n}\n    "], ["\n    query Bulletins($first: Int!, $after: String) {\n  me {\n    id\n    unacknowledgedStatefulNotificationsWithBulletinEnabled(\n      first: $first\n      after: $after\n    ) {\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n      edges {\n        node {\n          id\n          title\n          body\n          createdAt\n          acknowledgedAt\n          bulletinEnabled\n          icon\n          action {\n            ... on OpenDeepLinkAction {\n              deepLink\n            }\n            ... on OpenExternalLinkAction {\n              url\n            }\n          }\n        }\n        cursor\n      }\n    }\n  }\n}\n    "])));
/**
 * __useBulletinsQuery__
 *
 * To run a query within a React component, call `useBulletinsQuery` and pass it any options that fit your needs.
 * When your component renders, `useBulletinsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBulletinsQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useBulletinsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(BulletinsDocument, options);
}
export function useBulletinsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(BulletinsDocument, options);
}
export function useBulletinsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(BulletinsDocument, options);
}
export var BusinessMapMarkersDocument = gql(templateObject_44 || (templateObject_44 = __makeTemplateObject(["\n    query businessMapMarkers {\n  businessMapMarkers {\n    username\n    mapInfo {\n      title\n      coordinates {\n        longitude\n        latitude\n      }\n    }\n  }\n}\n    "], ["\n    query businessMapMarkers {\n  businessMapMarkers {\n    username\n    mapInfo {\n      title\n      coordinates {\n        longitude\n        latitude\n      }\n    }\n  }\n}\n    "])));
/**
 * __useBusinessMapMarkersQuery__
 *
 * To run a query within a React component, call `useBusinessMapMarkersQuery` and pass it any options that fit your needs.
 * When your component renders, `useBusinessMapMarkersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBusinessMapMarkersQuery({
 *   variables: {
 *   },
 * });
 */
export function useBusinessMapMarkersQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(BusinessMapMarkersDocument, options);
}
export function useBusinessMapMarkersLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(BusinessMapMarkersDocument, options);
}
export function useBusinessMapMarkersSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(BusinessMapMarkersDocument, options);
}
export var StatefulNotificationAcknowledgeDocument = gql(templateObject_45 || (templateObject_45 = __makeTemplateObject(["\n    mutation StatefulNotificationAcknowledge($input: StatefulNotificationAcknowledgeInput!) {\n  statefulNotificationAcknowledge(input: $input) {\n    notification {\n      acknowledgedAt\n    }\n  }\n}\n    "], ["\n    mutation StatefulNotificationAcknowledge($input: StatefulNotificationAcknowledgeInput!) {\n  statefulNotificationAcknowledge(input: $input) {\n    notification {\n      acknowledgedAt\n    }\n  }\n}\n    "])));
/**
 * __useStatefulNotificationAcknowledgeMutation__
 *
 * To run a mutation, you first call `useStatefulNotificationAcknowledgeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStatefulNotificationAcknowledgeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [statefulNotificationAcknowledgeMutation, { data, loading, error }] = useStatefulNotificationAcknowledgeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useStatefulNotificationAcknowledgeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(StatefulNotificationAcknowledgeDocument, options);
}
export var StatefulNotificationsDocument = gql(templateObject_46 || (templateObject_46 = __makeTemplateObject(["\n    query StatefulNotifications($after: String) {\n  me {\n    statefulNotificationsWithoutBulletinEnabled(first: 20, after: $after) {\n      nodes {\n        id\n        title\n        body\n        createdAt\n        acknowledgedAt\n        bulletinEnabled\n        icon\n        action {\n          ... on OpenDeepLinkAction {\n            deepLink\n          }\n          ... on OpenExternalLinkAction {\n            url\n          }\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n}\n    "], ["\n    query StatefulNotifications($after: String) {\n  me {\n    statefulNotificationsWithoutBulletinEnabled(first: 20, after: $after) {\n      nodes {\n        id\n        title\n        body\n        createdAt\n        acknowledgedAt\n        bulletinEnabled\n        icon\n        action {\n          ... on OpenDeepLinkAction {\n            deepLink\n          }\n          ... on OpenExternalLinkAction {\n            url\n          }\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n}\n    "])));
/**
 * __useStatefulNotificationsQuery__
 *
 * To run a query within a React component, call `useStatefulNotificationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useStatefulNotificationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useStatefulNotificationsQuery({
 *   variables: {
 *      after: // value for 'after'
 *   },
 * });
 */
export function useStatefulNotificationsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(StatefulNotificationsDocument, options);
}
export function useStatefulNotificationsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(StatefulNotificationsDocument, options);
}
export function useStatefulNotificationsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(StatefulNotificationsDocument, options);
}
export var CirclesDocument = gql(templateObject_47 || (templateObject_47 = __makeTemplateObject(["\n    query Circles {\n  me {\n    id\n    username\n    defaultAccount {\n      id\n      ... on ConsumerAccount {\n        welcomeProfile {\n          allTimePoints\n          allTimeRank\n          innerCircleAllTimeCount\n          innerCircleThisMonthCount\n          outerCircleAllTimeCount\n          outerCircleThisMonthCount\n          thisMonthPoints\n          thisMonthRank\n        }\n      }\n    }\n  }\n}\n    "], ["\n    query Circles {\n  me {\n    id\n    username\n    defaultAccount {\n      id\n      ... on ConsumerAccount {\n        welcomeProfile {\n          allTimePoints\n          allTimeRank\n          innerCircleAllTimeCount\n          innerCircleThisMonthCount\n          outerCircleAllTimeCount\n          outerCircleThisMonthCount\n          thisMonthPoints\n          thisMonthRank\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useCirclesQuery__
 *
 * To run a query within a React component, call `useCirclesQuery` and pass it any options that fit your needs.
 * When your component renders, `useCirclesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCirclesQuery({
 *   variables: {
 *   },
 * });
 */
export function useCirclesQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(CirclesDocument, options);
}
export function useCirclesLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(CirclesDocument, options);
}
export function useCirclesSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(CirclesDocument, options);
}
export var ContactsDocument = gql(templateObject_48 || (templateObject_48 = __makeTemplateObject(["\n    query contacts {\n  me {\n    id\n    contacts {\n      id\n      handle\n      username\n      alias\n      transactionsCount\n    }\n  }\n}\n    "], ["\n    query contacts {\n  me {\n    id\n    contacts {\n      id\n      handle\n      username\n      alias\n      transactionsCount\n    }\n  }\n}\n    "])));
/**
 * __useContactsQuery__
 *
 * To run a query within a React component, call `useContactsQuery` and pass it any options that fit your needs.
 * When your component renders, `useContactsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useContactsQuery({
 *   variables: {
 *   },
 * });
 */
export function useContactsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(ContactsDocument, options);
}
export function useContactsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(ContactsDocument, options);
}
export function useContactsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(ContactsDocument, options);
}
export var TransactionListForContactDocument = gql(templateObject_49 || (templateObject_49 = __makeTemplateObject(["\n    query transactionListForContact($username: Username!, $first: Int, $after: String, $last: Int, $before: String) {\n  me {\n    id\n    contactByUsername(username: $username) {\n      transactions(first: $first, after: $after, last: $last, before: $before) {\n        ...TransactionList\n      }\n    }\n  }\n}\n    ", ""], ["\n    query transactionListForContact($username: Username!, $first: Int, $after: String, $last: Int, $before: String) {\n  me {\n    id\n    contactByUsername(username: $username) {\n      transactions(first: $first, after: $after, last: $last, before: $before) {\n        ...TransactionList\n      }\n    }\n  }\n}\n    ", ""])), TransactionListFragmentDoc);
/**
 * __useTransactionListForContactQuery__
 *
 * To run a query within a React component, call `useTransactionListForContactQuery` and pass it any options that fit your needs.
 * When your component renders, `useTransactionListForContactQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTransactionListForContactQuery({
 *   variables: {
 *      username: // value for 'username'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      last: // value for 'last'
 *      before: // value for 'before'
 *   },
 * });
 */
export function useTransactionListForContactQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(TransactionListForContactDocument, options);
}
export function useTransactionListForContactLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(TransactionListForContactDocument, options);
}
export function useTransactionListForContactSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(TransactionListForContactDocument, options);
}
export var ContactsCardDocument = gql(templateObject_50 || (templateObject_50 = __makeTemplateObject(["\n    query ContactsCard {\n  me {\n    id\n    contacts {\n      id\n      handle\n      username\n      alias\n      transactionsCount\n    }\n  }\n}\n    "], ["\n    query ContactsCard {\n  me {\n    id\n    contacts {\n      id\n      handle\n      username\n      alias\n      transactionsCount\n    }\n  }\n}\n    "])));
/**
 * __useContactsCardQuery__
 *
 * To run a query within a React component, call `useContactsCardQuery` and pass it any options that fit your needs.
 * When your component renders, `useContactsCardQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useContactsCardQuery({
 *   variables: {
 *   },
 * });
 */
export function useContactsCardQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(ContactsCardDocument, options);
}
export function useContactsCardLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(ContactsCardDocument, options);
}
export function useContactsCardSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(ContactsCardDocument, options);
}
export var UserContactUpdateAliasDocument = gql(templateObject_51 || (templateObject_51 = __makeTemplateObject(["\n    mutation userContactUpdateAlias($input: UserContactUpdateAliasInput!) {\n  userContactUpdateAlias(input: $input) {\n    errors {\n      message\n    }\n    contact {\n      alias\n      id\n    }\n  }\n}\n    "], ["\n    mutation userContactUpdateAlias($input: UserContactUpdateAliasInput!) {\n  userContactUpdateAlias(input: $input) {\n    errors {\n      message\n    }\n    contact {\n      alias\n      id\n    }\n  }\n}\n    "])));
/**
 * __useUserContactUpdateAliasMutation__
 *
 * To run a mutation, you first call `useUserContactUpdateAliasMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserContactUpdateAliasMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userContactUpdateAliasMutation, { data, loading, error }] = useUserContactUpdateAliasMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserContactUpdateAliasMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserContactUpdateAliasDocument, options);
}
export var UserLoginDocument = gql(templateObject_52 || (templateObject_52 = __makeTemplateObject(["\n    mutation userLogin($input: UserLoginInput!) {\n  userLogin(input: $input) {\n    errors {\n      message\n      code\n    }\n    authToken\n    totpRequired\n  }\n}\n    "], ["\n    mutation userLogin($input: UserLoginInput!) {\n  userLogin(input: $input) {\n    errors {\n      message\n      code\n    }\n    authToken\n    totpRequired\n  }\n}\n    "])));
/**
 * __useUserLoginMutation__
 *
 * To run a mutation, you first call `useUserLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userLoginMutation, { data, loading, error }] = useUserLoginMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserLoginMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserLoginDocument, options);
}
export var UserLoginUpgradeDocument = gql(templateObject_53 || (templateObject_53 = __makeTemplateObject(["\n    mutation userLoginUpgrade($input: UserLoginUpgradeInput!) {\n  userLoginUpgrade(input: $input) {\n    errors {\n      message\n      code\n    }\n    success\n    authToken\n  }\n}\n    "], ["\n    mutation userLoginUpgrade($input: UserLoginUpgradeInput!) {\n  userLoginUpgrade(input: $input) {\n    errors {\n      message\n      code\n    }\n    success\n    authToken\n  }\n}\n    "])));
/**
 * __useUserLoginUpgradeMutation__
 *
 * To run a mutation, you first call `useUserLoginUpgradeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserLoginUpgradeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userLoginUpgradeMutation, { data, loading, error }] = useUserLoginUpgradeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserLoginUpgradeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserLoginUpgradeDocument, options);
}
export var UserPhoneRegistrationValidateDocument = gql(templateObject_54 || (templateObject_54 = __makeTemplateObject(["\n    mutation userPhoneRegistrationValidate($input: UserPhoneRegistrationValidateInput!) {\n  userPhoneRegistrationValidate(input: $input) {\n    errors {\n      message\n      code\n    }\n    me {\n      id\n      phone\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "], ["\n    mutation userPhoneRegistrationValidate($input: UserPhoneRegistrationValidateInput!) {\n  userPhoneRegistrationValidate(input: $input) {\n    errors {\n      message\n      code\n    }\n    me {\n      id\n      phone\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "])));
/**
 * __useUserPhoneRegistrationValidateMutation__
 *
 * To run a mutation, you first call `useUserPhoneRegistrationValidateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserPhoneRegistrationValidateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userPhoneRegistrationValidateMutation, { data, loading, error }] = useUserPhoneRegistrationValidateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserPhoneRegistrationValidateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserPhoneRegistrationValidateDocument, options);
}
export var CaptchaRequestAuthCodeDocument = gql(templateObject_55 || (templateObject_55 = __makeTemplateObject(["\n    mutation captchaRequestAuthCode($input: CaptchaRequestAuthCodeInput!) {\n  captchaRequestAuthCode(input: $input) {\n    errors {\n      message\n      code\n    }\n    success\n  }\n}\n    "], ["\n    mutation captchaRequestAuthCode($input: CaptchaRequestAuthCodeInput!) {\n  captchaRequestAuthCode(input: $input) {\n    errors {\n      message\n      code\n    }\n    success\n  }\n}\n    "])));
/**
 * __useCaptchaRequestAuthCodeMutation__
 *
 * To run a mutation, you first call `useCaptchaRequestAuthCodeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCaptchaRequestAuthCodeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [captchaRequestAuthCodeMutation, { data, loading, error }] = useCaptchaRequestAuthCodeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCaptchaRequestAuthCodeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(CaptchaRequestAuthCodeDocument, options);
}
export var SupportedCountriesDocument = gql(templateObject_56 || (templateObject_56 = __makeTemplateObject(["\n    query supportedCountries {\n  globals {\n    supportedCountries {\n      id\n      supportedAuthChannels\n    }\n  }\n}\n    "], ["\n    query supportedCountries {\n  globals {\n    supportedCountries {\n      id\n      supportedAuthChannels\n    }\n  }\n}\n    "])));
/**
 * __useSupportedCountriesQuery__
 *
 * To run a query within a React component, call `useSupportedCountriesQuery` and pass it any options that fit your needs.
 * When your component renders, `useSupportedCountriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSupportedCountriesQuery({
 *   variables: {
 *   },
 * });
 */
export function useSupportedCountriesQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SupportedCountriesDocument, options);
}
export function useSupportedCountriesLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SupportedCountriesDocument, options);
}
export function useSupportedCountriesSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SupportedCountriesDocument, options);
}
export var UserPhoneRegistrationInitiateDocument = gql(templateObject_57 || (templateObject_57 = __makeTemplateObject(["\n    mutation userPhoneRegistrationInitiate($input: UserPhoneRegistrationInitiateInput!) {\n  userPhoneRegistrationInitiate(input: $input) {\n    errors {\n      message\n    }\n    success\n  }\n}\n    "], ["\n    mutation userPhoneRegistrationInitiate($input: UserPhoneRegistrationInitiateInput!) {\n  userPhoneRegistrationInitiate(input: $input) {\n    errors {\n      message\n    }\n    success\n  }\n}\n    "])));
/**
 * __useUserPhoneRegistrationInitiateMutation__
 *
 * To run a mutation, you first call `useUserPhoneRegistrationInitiateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserPhoneRegistrationInitiateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userPhoneRegistrationInitiateMutation, { data, loading, error }] = useUserPhoneRegistrationInitiateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserPhoneRegistrationInitiateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserPhoneRegistrationInitiateDocument, options);
}
export var PriceHistoryScreenDocument = gql(templateObject_58 || (templateObject_58 = __makeTemplateObject(["\n    query priceHistoryScreen {\n  me {\n    id\n    defaultAccount {\n      id\n    }\n  }\n}\n    "], ["\n    query priceHistoryScreen {\n  me {\n    id\n    defaultAccount {\n      id\n    }\n  }\n}\n    "])));
/**
 * __usePriceHistoryScreenQuery__
 *
 * To run a query within a React component, call `usePriceHistoryScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `usePriceHistoryScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePriceHistoryScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function usePriceHistoryScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(PriceHistoryScreenDocument, options);
}
export function usePriceHistoryScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(PriceHistoryScreenDocument, options);
}
export function usePriceHistoryScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(PriceHistoryScreenDocument, options);
}
export var MyLnUpdatesDocument = gql(templateObject_59 || (templateObject_59 = __makeTemplateObject(["\n    subscription myLnUpdates {\n  myUpdates {\n    errors {\n      message\n    }\n    update {\n      ... on LnUpdate {\n        paymentHash\n        status\n      }\n    }\n  }\n}\n    "], ["\n    subscription myLnUpdates {\n  myUpdates {\n    errors {\n      message\n    }\n    update {\n      ... on LnUpdate {\n        paymentHash\n        status\n      }\n    }\n  }\n}\n    "])));
/**
 * __useMyLnUpdatesSubscription__
 *
 * To run a query within a React component, call `useMyLnUpdatesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useMyLnUpdatesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMyLnUpdatesSubscription({
 *   variables: {
 *   },
 * });
 */
export function useMyLnUpdatesSubscription(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSubscription(MyLnUpdatesDocument, options);
}
export var PaymentRequestDocument = gql(templateObject_60 || (templateObject_60 = __makeTemplateObject(["\n    query paymentRequest {\n  globals {\n    network\n    feesInformation {\n      deposit {\n        minBankFee\n        minBankFeeThreshold\n      }\n    }\n  }\n  me {\n    id\n    username\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n      defaultWalletId\n    }\n  }\n}\n    "], ["\n    query paymentRequest {\n  globals {\n    network\n    feesInformation {\n      deposit {\n        minBankFee\n        minBankFeeThreshold\n      }\n    }\n  }\n  me {\n    id\n    username\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n      defaultWalletId\n    }\n  }\n}\n    "])));
/**
 * __usePaymentRequestQuery__
 *
 * To run a query within a React component, call `usePaymentRequestQuery` and pass it any options that fit your needs.
 * When your component renders, `usePaymentRequestQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePaymentRequestQuery({
 *   variables: {
 *   },
 * });
 */
export function usePaymentRequestQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(PaymentRequestDocument, options);
}
export function usePaymentRequestLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(PaymentRequestDocument, options);
}
export function usePaymentRequestSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(PaymentRequestDocument, options);
}
export var LnNoAmountInvoiceCreateDocument = gql(templateObject_61 || (templateObject_61 = __makeTemplateObject(["\n    mutation lnNoAmountInvoiceCreate($input: LnNoAmountInvoiceCreateInput!) {\n  lnNoAmountInvoiceCreate(input: $input) {\n    errors {\n      message\n    }\n    invoice {\n      createdAt\n      paymentHash\n      paymentRequest\n      paymentStatus\n      externalId\n    }\n  }\n}\n    "], ["\n    mutation lnNoAmountInvoiceCreate($input: LnNoAmountInvoiceCreateInput!) {\n  lnNoAmountInvoiceCreate(input: $input) {\n    errors {\n      message\n    }\n    invoice {\n      createdAt\n      paymentHash\n      paymentRequest\n      paymentStatus\n      externalId\n    }\n  }\n}\n    "])));
/**
 * __useLnNoAmountInvoiceCreateMutation__
 *
 * To run a mutation, you first call `useLnNoAmountInvoiceCreateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnNoAmountInvoiceCreateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnNoAmountInvoiceCreateMutation, { data, loading, error }] = useLnNoAmountInvoiceCreateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnNoAmountInvoiceCreateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnNoAmountInvoiceCreateDocument, options);
}
export var LnInvoiceCreateDocument = gql(templateObject_62 || (templateObject_62 = __makeTemplateObject(["\n    mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {\n  lnInvoiceCreate(input: $input) {\n    errors {\n      message\n    }\n    invoice {\n      createdAt\n      paymentHash\n      paymentRequest\n      paymentStatus\n      externalId\n      satoshis\n    }\n  }\n}\n    "], ["\n    mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {\n  lnInvoiceCreate(input: $input) {\n    errors {\n      message\n    }\n    invoice {\n      createdAt\n      paymentHash\n      paymentRequest\n      paymentStatus\n      externalId\n      satoshis\n    }\n  }\n}\n    "])));
/**
 * __useLnInvoiceCreateMutation__
 *
 * To run a mutation, you first call `useLnInvoiceCreateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnInvoiceCreateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnInvoiceCreateMutation, { data, loading, error }] = useLnInvoiceCreateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnInvoiceCreateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnInvoiceCreateDocument, options);
}
export var OnChainAddressCurrentDocument = gql(templateObject_63 || (templateObject_63 = __makeTemplateObject(["\n    mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {\n  onChainAddressCurrent(input: $input) {\n    errors {\n      message\n    }\n    address\n  }\n}\n    "], ["\n    mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {\n  onChainAddressCurrent(input: $input) {\n    errors {\n      message\n    }\n    address\n  }\n}\n    "])));
/**
 * __useOnChainAddressCurrentMutation__
 *
 * To run a mutation, you first call `useOnChainAddressCurrentMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useOnChainAddressCurrentMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [onChainAddressCurrentMutation, { data, loading, error }] = useOnChainAddressCurrentMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useOnChainAddressCurrentMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(OnChainAddressCurrentDocument, options);
}
export var LnUsdInvoiceCreateDocument = gql(templateObject_64 || (templateObject_64 = __makeTemplateObject(["\n    mutation lnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {\n  lnUsdInvoiceCreate(input: $input) {\n    errors {\n      message\n    }\n    invoice {\n      createdAt\n      paymentHash\n      paymentRequest\n      paymentStatus\n      externalId\n      satoshis\n    }\n  }\n}\n    "], ["\n    mutation lnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {\n  lnUsdInvoiceCreate(input: $input) {\n    errors {\n      message\n    }\n    invoice {\n      createdAt\n      paymentHash\n      paymentRequest\n      paymentStatus\n      externalId\n      satoshis\n    }\n  }\n}\n    "])));
/**
 * __useLnUsdInvoiceCreateMutation__
 *
 * To run a mutation, you first call `useLnUsdInvoiceCreateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnUsdInvoiceCreateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnUsdInvoiceCreateMutation, { data, loading, error }] = useLnUsdInvoiceCreateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnUsdInvoiceCreateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnUsdInvoiceCreateDocument, options);
}
export var ScanningQrCodeScreenDocument = gql(templateObject_65 || (templateObject_65 = __makeTemplateObject(["\n    query scanningQRCodeScreen {\n  globals {\n    network\n  }\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n      }\n    }\n    contacts {\n      id\n      handle\n      username\n    }\n  }\n}\n    "], ["\n    query scanningQRCodeScreen {\n  globals {\n    network\n  }\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n      }\n    }\n    contacts {\n      id\n      handle\n      username\n    }\n  }\n}\n    "])));
/**
 * __useScanningQrCodeScreenQuery__
 *
 * To run a query within a React component, call `useScanningQrCodeScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useScanningQrCodeScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useScanningQrCodeScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useScanningQrCodeScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(ScanningQrCodeScreenDocument, options);
}
export function useScanningQrCodeScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(ScanningQrCodeScreenDocument, options);
}
export function useScanningQrCodeScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(ScanningQrCodeScreenDocument, options);
}
export var SendBitcoinConfirmationScreenDocument = gql(templateObject_66 || (templateObject_66 = __makeTemplateObject(["\n    query sendBitcoinConfirmationScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "], ["\n    query sendBitcoinConfirmationScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "])));
/**
 * __useSendBitcoinConfirmationScreenQuery__
 *
 * To run a query within a React component, call `useSendBitcoinConfirmationScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useSendBitcoinConfirmationScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSendBitcoinConfirmationScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useSendBitcoinConfirmationScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SendBitcoinConfirmationScreenDocument, options);
}
export function useSendBitcoinConfirmationScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SendBitcoinConfirmationScreenDocument, options);
}
export function useSendBitcoinConfirmationScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SendBitcoinConfirmationScreenDocument, options);
}
export var SendBitcoinDestinationDocument = gql(templateObject_67 || (templateObject_67 = __makeTemplateObject(["\n    query sendBitcoinDestination {\n  globals {\n    network\n  }\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n      }\n    }\n    contacts {\n      id\n      handle\n      username\n      alias\n      transactionsCount\n    }\n  }\n}\n    "], ["\n    query sendBitcoinDestination {\n  globals {\n    network\n  }\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        id\n      }\n    }\n    contacts {\n      id\n      handle\n      username\n      alias\n      transactionsCount\n    }\n  }\n}\n    "])));
/**
 * __useSendBitcoinDestinationQuery__
 *
 * To run a query within a React component, call `useSendBitcoinDestinationQuery` and pass it any options that fit your needs.
 * When your component renders, `useSendBitcoinDestinationQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSendBitcoinDestinationQuery({
 *   variables: {
 *   },
 * });
 */
export function useSendBitcoinDestinationQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SendBitcoinDestinationDocument, options);
}
export function useSendBitcoinDestinationLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SendBitcoinDestinationDocument, options);
}
export function useSendBitcoinDestinationSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SendBitcoinDestinationDocument, options);
}
export var AccountDefaultWalletDocument = gql(templateObject_68 || (templateObject_68 = __makeTemplateObject(["\n    query accountDefaultWallet($walletCurrency: WalletCurrency, $username: Username!) {\n  accountDefaultWallet(walletCurrency: $walletCurrency, username: $username) {\n    id\n  }\n}\n    "], ["\n    query accountDefaultWallet($walletCurrency: WalletCurrency, $username: Username!) {\n  accountDefaultWallet(walletCurrency: $walletCurrency, username: $username) {\n    id\n  }\n}\n    "])));
/**
 * __useAccountDefaultWalletQuery__
 *
 * To run a query within a React component, call `useAccountDefaultWalletQuery` and pass it any options that fit your needs.
 * When your component renders, `useAccountDefaultWalletQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAccountDefaultWalletQuery({
 *   variables: {
 *      walletCurrency: // value for 'walletCurrency'
 *      username: // value for 'username'
 *   },
 * });
 */
export function useAccountDefaultWalletQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(AccountDefaultWalletDocument, options);
}
export function useAccountDefaultWalletLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(AccountDefaultWalletDocument, options);
}
export function useAccountDefaultWalletSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(AccountDefaultWalletDocument, options);
}
export var SendBitcoinDetailsScreenDocument = gql(templateObject_69 || (templateObject_69 = __makeTemplateObject(["\n    query sendBitcoinDetailsScreen {\n  globals {\n    network\n  }\n  me {\n    id\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        walletCurrency\n        balance\n      }\n    }\n  }\n}\n    "], ["\n    query sendBitcoinDetailsScreen {\n  globals {\n    network\n  }\n  me {\n    id\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        walletCurrency\n        balance\n      }\n    }\n  }\n}\n    "])));
/**
 * __useSendBitcoinDetailsScreenQuery__
 *
 * To run a query within a React component, call `useSendBitcoinDetailsScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useSendBitcoinDetailsScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSendBitcoinDetailsScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useSendBitcoinDetailsScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SendBitcoinDetailsScreenDocument, options);
}
export function useSendBitcoinDetailsScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SendBitcoinDetailsScreenDocument, options);
}
export function useSendBitcoinDetailsScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SendBitcoinDetailsScreenDocument, options);
}
export var SendBitcoinWithdrawalLimitsDocument = gql(templateObject_70 || (templateObject_70 = __makeTemplateObject(["\n    query sendBitcoinWithdrawalLimits {\n  me {\n    id\n    defaultAccount {\n      id\n      limits {\n        withdrawal {\n          totalLimit\n          remainingLimit\n          interval\n        }\n      }\n    }\n  }\n}\n    "], ["\n    query sendBitcoinWithdrawalLimits {\n  me {\n    id\n    defaultAccount {\n      id\n      limits {\n        withdrawal {\n          totalLimit\n          remainingLimit\n          interval\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useSendBitcoinWithdrawalLimitsQuery__
 *
 * To run a query within a React component, call `useSendBitcoinWithdrawalLimitsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSendBitcoinWithdrawalLimitsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSendBitcoinWithdrawalLimitsQuery({
 *   variables: {
 *   },
 * });
 */
export function useSendBitcoinWithdrawalLimitsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SendBitcoinWithdrawalLimitsDocument, options);
}
export function useSendBitcoinWithdrawalLimitsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SendBitcoinWithdrawalLimitsDocument, options);
}
export function useSendBitcoinWithdrawalLimitsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SendBitcoinWithdrawalLimitsDocument, options);
}
export var SendBitcoinInternalLimitsDocument = gql(templateObject_71 || (templateObject_71 = __makeTemplateObject(["\n    query sendBitcoinInternalLimits {\n  me {\n    id\n    defaultAccount {\n      id\n      limits {\n        internalSend {\n          totalLimit\n          remainingLimit\n          interval\n        }\n      }\n    }\n  }\n}\n    "], ["\n    query sendBitcoinInternalLimits {\n  me {\n    id\n    defaultAccount {\n      id\n      limits {\n        internalSend {\n          totalLimit\n          remainingLimit\n          interval\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useSendBitcoinInternalLimitsQuery__
 *
 * To run a query within a React component, call `useSendBitcoinInternalLimitsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSendBitcoinInternalLimitsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSendBitcoinInternalLimitsQuery({
 *   variables: {
 *   },
 * });
 */
export function useSendBitcoinInternalLimitsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SendBitcoinInternalLimitsDocument, options);
}
export function useSendBitcoinInternalLimitsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SendBitcoinInternalLimitsDocument, options);
}
export function useSendBitcoinInternalLimitsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SendBitcoinInternalLimitsDocument, options);
}
export var FeedbackSubmitDocument = gql(templateObject_72 || (templateObject_72 = __makeTemplateObject(["\n    mutation feedbackSubmit($input: FeedbackSubmitInput!) {\n  feedbackSubmit(input: $input) {\n    errors {\n      message\n      __typename\n    }\n    success\n    __typename\n  }\n}\n    "], ["\n    mutation feedbackSubmit($input: FeedbackSubmitInput!) {\n  feedbackSubmit(input: $input) {\n    errors {\n      message\n      __typename\n    }\n    success\n    __typename\n  }\n}\n    "])));
/**
 * __useFeedbackSubmitMutation__
 *
 * To run a mutation, you first call `useFeedbackSubmitMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useFeedbackSubmitMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [feedbackSubmitMutation, { data, loading, error }] = useFeedbackSubmitMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useFeedbackSubmitMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(FeedbackSubmitDocument, options);
}
export var LnNoAmountInvoiceFeeProbeDocument = gql(templateObject_73 || (templateObject_73 = __makeTemplateObject(["\n    mutation lnNoAmountInvoiceFeeProbe($input: LnNoAmountInvoiceFeeProbeInput!) {\n  lnNoAmountInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "], ["\n    mutation lnNoAmountInvoiceFeeProbe($input: LnNoAmountInvoiceFeeProbeInput!) {\n  lnNoAmountInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "])));
/**
 * __useLnNoAmountInvoiceFeeProbeMutation__
 *
 * To run a mutation, you first call `useLnNoAmountInvoiceFeeProbeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnNoAmountInvoiceFeeProbeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnNoAmountInvoiceFeeProbeMutation, { data, loading, error }] = useLnNoAmountInvoiceFeeProbeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnNoAmountInvoiceFeeProbeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnNoAmountInvoiceFeeProbeDocument, options);
}
export var LnInvoiceFeeProbeDocument = gql(templateObject_74 || (templateObject_74 = __makeTemplateObject(["\n    mutation lnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {\n  lnInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "], ["\n    mutation lnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {\n  lnInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "])));
/**
 * __useLnInvoiceFeeProbeMutation__
 *
 * To run a mutation, you first call `useLnInvoiceFeeProbeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnInvoiceFeeProbeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnInvoiceFeeProbeMutation, { data, loading, error }] = useLnInvoiceFeeProbeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnInvoiceFeeProbeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnInvoiceFeeProbeDocument, options);
}
export var LnUsdInvoiceFeeProbeDocument = gql(templateObject_75 || (templateObject_75 = __makeTemplateObject(["\n    mutation lnUsdInvoiceFeeProbe($input: LnUsdInvoiceFeeProbeInput!) {\n  lnUsdInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "], ["\n    mutation lnUsdInvoiceFeeProbe($input: LnUsdInvoiceFeeProbeInput!) {\n  lnUsdInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "])));
/**
 * __useLnUsdInvoiceFeeProbeMutation__
 *
 * To run a mutation, you first call `useLnUsdInvoiceFeeProbeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnUsdInvoiceFeeProbeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnUsdInvoiceFeeProbeMutation, { data, loading, error }] = useLnUsdInvoiceFeeProbeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnUsdInvoiceFeeProbeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnUsdInvoiceFeeProbeDocument, options);
}
export var LnNoAmountUsdInvoiceFeeProbeDocument = gql(templateObject_76 || (templateObject_76 = __makeTemplateObject(["\n    mutation lnNoAmountUsdInvoiceFeeProbe($input: LnNoAmountUsdInvoiceFeeProbeInput!) {\n  lnNoAmountUsdInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "], ["\n    mutation lnNoAmountUsdInvoiceFeeProbe($input: LnNoAmountUsdInvoiceFeeProbeInput!) {\n  lnNoAmountUsdInvoiceFeeProbe(input: $input) {\n    errors {\n      message\n    }\n    amount\n  }\n}\n    "])));
/**
 * __useLnNoAmountUsdInvoiceFeeProbeMutation__
 *
 * To run a mutation, you first call `useLnNoAmountUsdInvoiceFeeProbeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnNoAmountUsdInvoiceFeeProbeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnNoAmountUsdInvoiceFeeProbeMutation, { data, loading, error }] = useLnNoAmountUsdInvoiceFeeProbeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnNoAmountUsdInvoiceFeeProbeMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnNoAmountUsdInvoiceFeeProbeDocument, options);
}
export var OnChainTxFeeDocument = gql(templateObject_77 || (templateObject_77 = __makeTemplateObject(["\n    query onChainTxFee($walletId: WalletId!, $address: OnChainAddress!, $amount: SatAmount!) {\n  onChainTxFee(walletId: $walletId, address: $address, amount: $amount) {\n    amount\n  }\n}\n    "], ["\n    query onChainTxFee($walletId: WalletId!, $address: OnChainAddress!, $amount: SatAmount!) {\n  onChainTxFee(walletId: $walletId, address: $address, amount: $amount) {\n    amount\n  }\n}\n    "])));
/**
 * __useOnChainTxFeeQuery__
 *
 * To run a query within a React component, call `useOnChainTxFeeQuery` and pass it any options that fit your needs.
 * When your component renders, `useOnChainTxFeeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnChainTxFeeQuery({
 *   variables: {
 *      walletId: // value for 'walletId'
 *      address: // value for 'address'
 *      amount: // value for 'amount'
 *   },
 * });
 */
export function useOnChainTxFeeQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(OnChainTxFeeDocument, options);
}
export function useOnChainTxFeeLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(OnChainTxFeeDocument, options);
}
export function useOnChainTxFeeSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(OnChainTxFeeDocument, options);
}
export var OnChainUsdTxFeeDocument = gql(templateObject_78 || (templateObject_78 = __makeTemplateObject(["\n    query onChainUsdTxFee($walletId: WalletId!, $address: OnChainAddress!, $amount: CentAmount!) {\n  onChainUsdTxFee(walletId: $walletId, address: $address, amount: $amount) {\n    amount\n  }\n}\n    "], ["\n    query onChainUsdTxFee($walletId: WalletId!, $address: OnChainAddress!, $amount: CentAmount!) {\n  onChainUsdTxFee(walletId: $walletId, address: $address, amount: $amount) {\n    amount\n  }\n}\n    "])));
/**
 * __useOnChainUsdTxFeeQuery__
 *
 * To run a query within a React component, call `useOnChainUsdTxFeeQuery` and pass it any options that fit your needs.
 * When your component renders, `useOnChainUsdTxFeeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnChainUsdTxFeeQuery({
 *   variables: {
 *      walletId: // value for 'walletId'
 *      address: // value for 'address'
 *      amount: // value for 'amount'
 *   },
 * });
 */
export function useOnChainUsdTxFeeQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(OnChainUsdTxFeeDocument, options);
}
export function useOnChainUsdTxFeeLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(OnChainUsdTxFeeDocument, options);
}
export function useOnChainUsdTxFeeSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(OnChainUsdTxFeeDocument, options);
}
export var OnChainUsdTxFeeAsBtcDenominatedDocument = gql(templateObject_79 || (templateObject_79 = __makeTemplateObject(["\n    query onChainUsdTxFeeAsBtcDenominated($walletId: WalletId!, $address: OnChainAddress!, $amount: SatAmount!) {\n  onChainUsdTxFeeAsBtcDenominated(\n    walletId: $walletId\n    address: $address\n    amount: $amount\n  ) {\n    amount\n  }\n}\n    "], ["\n    query onChainUsdTxFeeAsBtcDenominated($walletId: WalletId!, $address: OnChainAddress!, $amount: SatAmount!) {\n  onChainUsdTxFeeAsBtcDenominated(\n    walletId: $walletId\n    address: $address\n    amount: $amount\n  ) {\n    amount\n  }\n}\n    "])));
/**
 * __useOnChainUsdTxFeeAsBtcDenominatedQuery__
 *
 * To run a query within a React component, call `useOnChainUsdTxFeeAsBtcDenominatedQuery` and pass it any options that fit your needs.
 * When your component renders, `useOnChainUsdTxFeeAsBtcDenominatedQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnChainUsdTxFeeAsBtcDenominatedQuery({
 *   variables: {
 *      walletId: // value for 'walletId'
 *      address: // value for 'address'
 *      amount: // value for 'amount'
 *   },
 * });
 */
export function useOnChainUsdTxFeeAsBtcDenominatedQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(OnChainUsdTxFeeAsBtcDenominatedDocument, options);
}
export function useOnChainUsdTxFeeAsBtcDenominatedLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(OnChainUsdTxFeeAsBtcDenominatedDocument, options);
}
export function useOnChainUsdTxFeeAsBtcDenominatedSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(OnChainUsdTxFeeAsBtcDenominatedDocument, options);
}
export var ContactCreateDocument = gql(templateObject_80 || (templateObject_80 = __makeTemplateObject(["\n    mutation contactCreate($input: ContactCreateInput!) {\n  contactCreate(input: $input) {\n    errors {\n      message\n    }\n    contact {\n      id\n    }\n  }\n}\n    "], ["\n    mutation contactCreate($input: ContactCreateInput!) {\n  contactCreate(input: $input) {\n    errors {\n      message\n    }\n    contact {\n      id\n    }\n  }\n}\n    "])));
/**
 * __useContactCreateMutation__
 *
 * To run a mutation, you first call `useContactCreateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useContactCreateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [contactCreateMutation, { data, loading, error }] = useContactCreateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useContactCreateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(ContactCreateDocument, options);
}
export var IntraLedgerPaymentSendDocument = gql(templateObject_81 || (templateObject_81 = __makeTemplateObject(["\n    mutation intraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {\n  intraLedgerPaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "], ["\n    mutation intraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {\n  intraLedgerPaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "])));
/**
 * __useIntraLedgerPaymentSendMutation__
 *
 * To run a mutation, you first call `useIntraLedgerPaymentSendMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useIntraLedgerPaymentSendMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [intraLedgerPaymentSendMutation, { data, loading, error }] = useIntraLedgerPaymentSendMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useIntraLedgerPaymentSendMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(IntraLedgerPaymentSendDocument, options);
}
export var IntraLedgerUsdPaymentSendDocument = gql(templateObject_82 || (templateObject_82 = __makeTemplateObject(["\n    mutation intraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {\n  intraLedgerUsdPaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "], ["\n    mutation intraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {\n  intraLedgerUsdPaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "])));
/**
 * __useIntraLedgerUsdPaymentSendMutation__
 *
 * To run a mutation, you first call `useIntraLedgerUsdPaymentSendMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useIntraLedgerUsdPaymentSendMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [intraLedgerUsdPaymentSendMutation, { data, loading, error }] = useIntraLedgerUsdPaymentSendMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useIntraLedgerUsdPaymentSendMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(IntraLedgerUsdPaymentSendDocument, options);
}
export var LnNoAmountInvoicePaymentSendDocument = gql(templateObject_83 || (templateObject_83 = __makeTemplateObject(["\n    mutation lnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {\n  lnNoAmountInvoicePaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "], ["\n    mutation lnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {\n  lnNoAmountInvoicePaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "])));
/**
 * __useLnNoAmountInvoicePaymentSendMutation__
 *
 * To run a mutation, you first call `useLnNoAmountInvoicePaymentSendMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnNoAmountInvoicePaymentSendMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnNoAmountInvoicePaymentSendMutation, { data, loading, error }] = useLnNoAmountInvoicePaymentSendMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnNoAmountInvoicePaymentSendMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnNoAmountInvoicePaymentSendDocument, options);
}
export var LnInvoicePaymentSendDocument = gql(templateObject_84 || (templateObject_84 = __makeTemplateObject(["\n    mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {\n  lnInvoicePaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n      settlementVia {\n        ... on SettlementViaLn {\n          preImage\n        }\n        ... on SettlementViaIntraLedger {\n          preImage\n        }\n      }\n    }\n  }\n}\n    "], ["\n    mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {\n  lnInvoicePaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n      settlementVia {\n        ... on SettlementViaLn {\n          preImage\n        }\n        ... on SettlementViaIntraLedger {\n          preImage\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useLnInvoicePaymentSendMutation__
 *
 * To run a mutation, you first call `useLnInvoicePaymentSendMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnInvoicePaymentSendMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnInvoicePaymentSendMutation, { data, loading, error }] = useLnInvoicePaymentSendMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnInvoicePaymentSendMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnInvoicePaymentSendDocument, options);
}
export var LnNoAmountUsdInvoicePaymentSendDocument = gql(templateObject_85 || (templateObject_85 = __makeTemplateObject(["\n    mutation lnNoAmountUsdInvoicePaymentSend($input: LnNoAmountUsdInvoicePaymentInput!) {\n  lnNoAmountUsdInvoicePaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "], ["\n    mutation lnNoAmountUsdInvoicePaymentSend($input: LnNoAmountUsdInvoicePaymentInput!) {\n  lnNoAmountUsdInvoicePaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "])));
/**
 * __useLnNoAmountUsdInvoicePaymentSendMutation__
 *
 * To run a mutation, you first call `useLnNoAmountUsdInvoicePaymentSendMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLnNoAmountUsdInvoicePaymentSendMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [lnNoAmountUsdInvoicePaymentSendMutation, { data, loading, error }] = useLnNoAmountUsdInvoicePaymentSendMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLnNoAmountUsdInvoicePaymentSendMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(LnNoAmountUsdInvoicePaymentSendDocument, options);
}
export var OnChainPaymentSendDocument = gql(templateObject_86 || (templateObject_86 = __makeTemplateObject(["\n    mutation onChainPaymentSend($input: OnChainPaymentSendInput!) {\n  onChainPaymentSend(input: $input) {\n    transaction {\n      createdAt\n      settlementVia {\n        ... on SettlementViaOnChain {\n          arrivalInMempoolEstimatedAt\n        }\n      }\n    }\n    errors {\n      message\n    }\n    status\n  }\n}\n    "], ["\n    mutation onChainPaymentSend($input: OnChainPaymentSendInput!) {\n  onChainPaymentSend(input: $input) {\n    transaction {\n      createdAt\n      settlementVia {\n        ... on SettlementViaOnChain {\n          arrivalInMempoolEstimatedAt\n        }\n      }\n    }\n    errors {\n      message\n    }\n    status\n  }\n}\n    "])));
/**
 * __useOnChainPaymentSendMutation__
 *
 * To run a mutation, you first call `useOnChainPaymentSendMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useOnChainPaymentSendMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [onChainPaymentSendMutation, { data, loading, error }] = useOnChainPaymentSendMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useOnChainPaymentSendMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(OnChainPaymentSendDocument, options);
}
export var OnChainPaymentSendAllDocument = gql(templateObject_87 || (templateObject_87 = __makeTemplateObject(["\n    mutation onChainPaymentSendAll($input: OnChainPaymentSendAllInput!) {\n  onChainPaymentSendAll(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "], ["\n    mutation onChainPaymentSendAll($input: OnChainPaymentSendAllInput!) {\n  onChainPaymentSendAll(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "])));
/**
 * __useOnChainPaymentSendAllMutation__
 *
 * To run a mutation, you first call `useOnChainPaymentSendAllMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useOnChainPaymentSendAllMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [onChainPaymentSendAllMutation, { data, loading, error }] = useOnChainPaymentSendAllMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useOnChainPaymentSendAllMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(OnChainPaymentSendAllDocument, options);
}
export var OnChainUsdPaymentSendDocument = gql(templateObject_88 || (templateObject_88 = __makeTemplateObject(["\n    mutation onChainUsdPaymentSend($input: OnChainUsdPaymentSendInput!) {\n  onChainUsdPaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "], ["\n    mutation onChainUsdPaymentSend($input: OnChainUsdPaymentSendInput!) {\n  onChainUsdPaymentSend(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "])));
/**
 * __useOnChainUsdPaymentSendMutation__
 *
 * To run a mutation, you first call `useOnChainUsdPaymentSendMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useOnChainUsdPaymentSendMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [onChainUsdPaymentSendMutation, { data, loading, error }] = useOnChainUsdPaymentSendMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useOnChainUsdPaymentSendMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(OnChainUsdPaymentSendDocument, options);
}
export var OnChainUsdPaymentSendAsBtcDenominatedDocument = gql(templateObject_89 || (templateObject_89 = __makeTemplateObject(["\n    mutation onChainUsdPaymentSendAsBtcDenominated($input: OnChainUsdPaymentSendAsBtcDenominatedInput!) {\n  onChainUsdPaymentSendAsBtcDenominated(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "], ["\n    mutation onChainUsdPaymentSendAsBtcDenominated($input: OnChainUsdPaymentSendAsBtcDenominatedInput!) {\n  onChainUsdPaymentSendAsBtcDenominated(input: $input) {\n    errors {\n      message\n    }\n    status\n    transaction {\n      createdAt\n    }\n  }\n}\n    "])));
/**
 * __useOnChainUsdPaymentSendAsBtcDenominatedMutation__
 *
 * To run a mutation, you first call `useOnChainUsdPaymentSendAsBtcDenominatedMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useOnChainUsdPaymentSendAsBtcDenominatedMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [onChainUsdPaymentSendAsBtcDenominatedMutation, { data, loading, error }] = useOnChainUsdPaymentSendAsBtcDenominatedMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useOnChainUsdPaymentSendAsBtcDenominatedMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(OnChainUsdPaymentSendAsBtcDenominatedDocument, options);
}
export var AccountDeleteDocument = gql(templateObject_90 || (templateObject_90 = __makeTemplateObject(["\n    mutation accountDelete {\n  accountDelete {\n    errors {\n      message\n    }\n    success\n  }\n}\n    "], ["\n    mutation accountDelete {\n  accountDelete {\n    errors {\n      message\n    }\n    success\n  }\n}\n    "])));
/**
 * __useAccountDeleteMutation__
 *
 * To run a mutation, you first call `useAccountDeleteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAccountDeleteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [accountDeleteMutation, { data, loading, error }] = useAccountDeleteMutation({
 *   variables: {
 *   },
 * });
 */
export function useAccountDeleteMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(AccountDeleteDocument, options);
}
export var UserEmailDeleteDocument = gql(templateObject_91 || (templateObject_91 = __makeTemplateObject(["\n    mutation userEmailDelete {\n  userEmailDelete {\n    errors {\n      message\n    }\n    me {\n      id\n      phone\n      totpEnabled\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "], ["\n    mutation userEmailDelete {\n  userEmailDelete {\n    errors {\n      message\n    }\n    me {\n      id\n      phone\n      totpEnabled\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "])));
/**
 * __useUserEmailDeleteMutation__
 *
 * To run a mutation, you first call `useUserEmailDeleteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserEmailDeleteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userEmailDeleteMutation, { data, loading, error }] = useUserEmailDeleteMutation({
 *   variables: {
 *   },
 * });
 */
export function useUserEmailDeleteMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserEmailDeleteDocument, options);
}
export var UserPhoneDeleteDocument = gql(templateObject_92 || (templateObject_92 = __makeTemplateObject(["\n    mutation userPhoneDelete {\n  userPhoneDelete {\n    errors {\n      message\n    }\n    me {\n      id\n      phone\n      totpEnabled\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "], ["\n    mutation userPhoneDelete {\n  userPhoneDelete {\n    errors {\n      message\n    }\n    me {\n      id\n      phone\n      totpEnabled\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "])));
/**
 * __useUserPhoneDeleteMutation__
 *
 * To run a mutation, you first call `useUserPhoneDeleteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserPhoneDeleteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userPhoneDeleteMutation, { data, loading, error }] = useUserPhoneDeleteMutation({
 *   variables: {
 *   },
 * });
 */
export function useUserPhoneDeleteMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserPhoneDeleteDocument, options);
}
export var WarningSecureAccountDocument = gql(templateObject_93 || (templateObject_93 = __makeTemplateObject(["\n    query warningSecureAccount {\n  me {\n    id\n    defaultAccount {\n      level\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "], ["\n    query warningSecureAccount {\n  me {\n    id\n    defaultAccount {\n      level\n      id\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "])));
/**
 * __useWarningSecureAccountQuery__
 *
 * To run a query within a React component, call `useWarningSecureAccountQuery` and pass it any options that fit your needs.
 * When your component renders, `useWarningSecureAccountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useWarningSecureAccountQuery({
 *   variables: {
 *   },
 * });
 */
export function useWarningSecureAccountQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(WarningSecureAccountDocument, options);
}
export function useWarningSecureAccountLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(WarningSecureAccountDocument, options);
}
export function useWarningSecureAccountSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(WarningSecureAccountDocument, options);
}
export var AccountUpdateDefaultWalletIdDocument = gql(templateObject_94 || (templateObject_94 = __makeTemplateObject(["\n    mutation accountUpdateDefaultWalletId($input: AccountUpdateDefaultWalletIdInput!) {\n  accountUpdateDefaultWalletId(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      defaultWalletId\n    }\n  }\n}\n    "], ["\n    mutation accountUpdateDefaultWalletId($input: AccountUpdateDefaultWalletIdInput!) {\n  accountUpdateDefaultWalletId(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      defaultWalletId\n    }\n  }\n}\n    "])));
/**
 * __useAccountUpdateDefaultWalletIdMutation__
 *
 * To run a mutation, you first call `useAccountUpdateDefaultWalletIdMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAccountUpdateDefaultWalletIdMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [accountUpdateDefaultWalletIdMutation, { data, loading, error }] = useAccountUpdateDefaultWalletIdMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAccountUpdateDefaultWalletIdMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(AccountUpdateDefaultWalletIdDocument, options);
}
export var SetDefaultWalletScreenDocument = gql(templateObject_95 || (templateObject_95 = __makeTemplateObject(["\n    query setDefaultWalletScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "], ["\n    query setDefaultWalletScreen {\n  me {\n    id\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n  }\n}\n    "])));
/**
 * __useSetDefaultWalletScreenQuery__
 *
 * To run a query within a React component, call `useSetDefaultWalletScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useSetDefaultWalletScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSetDefaultWalletScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useSetDefaultWalletScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SetDefaultWalletScreenDocument, options);
}
export function useSetDefaultWalletScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SetDefaultWalletScreenDocument, options);
}
export function useSetDefaultWalletScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SetDefaultWalletScreenDocument, options);
}
export var AccountUpdateDisplayCurrencyDocument = gql(templateObject_96 || (templateObject_96 = __makeTemplateObject(["\n    mutation accountUpdateDisplayCurrency($input: AccountUpdateDisplayCurrencyInput!) {\n  accountUpdateDisplayCurrency(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      displayCurrency\n    }\n  }\n}\n    "], ["\n    mutation accountUpdateDisplayCurrency($input: AccountUpdateDisplayCurrencyInput!) {\n  accountUpdateDisplayCurrency(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      displayCurrency\n    }\n  }\n}\n    "])));
/**
 * __useAccountUpdateDisplayCurrencyMutation__
 *
 * To run a mutation, you first call `useAccountUpdateDisplayCurrencyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAccountUpdateDisplayCurrencyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [accountUpdateDisplayCurrencyMutation, { data, loading, error }] = useAccountUpdateDisplayCurrencyMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAccountUpdateDisplayCurrencyMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(AccountUpdateDisplayCurrencyDocument, options);
}
export var LanguageDocument = gql(templateObject_97 || (templateObject_97 = __makeTemplateObject(["\n    query language {\n  me {\n    id\n    language\n  }\n}\n    "], ["\n    query language {\n  me {\n    id\n    language\n  }\n}\n    "])));
/**
 * __useLanguageQuery__
 *
 * To run a query within a React component, call `useLanguageQuery` and pass it any options that fit your needs.
 * When your component renders, `useLanguageQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLanguageQuery({
 *   variables: {
 *   },
 * });
 */
export function useLanguageQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(LanguageDocument, options);
}
export function useLanguageLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(LanguageDocument, options);
}
export function useLanguageSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(LanguageDocument, options);
}
export var UserUpdateLanguageDocument = gql(templateObject_98 || (templateObject_98 = __makeTemplateObject(["\n    mutation userUpdateLanguage($input: UserUpdateLanguageInput!) {\n  userUpdateLanguage(input: $input) {\n    errors {\n      message\n    }\n    user {\n      id\n      language\n    }\n  }\n}\n    "], ["\n    mutation userUpdateLanguage($input: UserUpdateLanguageInput!) {\n  userUpdateLanguage(input: $input) {\n    errors {\n      message\n    }\n    user {\n      id\n      language\n    }\n  }\n}\n    "])));
/**
 * __useUserUpdateLanguageMutation__
 *
 * To run a mutation, you first call `useUserUpdateLanguageMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserUpdateLanguageMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userUpdateLanguageMutation, { data, loading, error }] = useUserUpdateLanguageMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserUpdateLanguageMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserUpdateLanguageDocument, options);
}
export var NotificationSettingsDocument = gql(templateObject_99 || (templateObject_99 = __makeTemplateObject(["\n    query notificationSettings {\n  me {\n    id\n    defaultAccount {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "], ["\n    query notificationSettings {\n  me {\n    id\n    defaultAccount {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useNotificationSettingsQuery__
 *
 * To run a query within a React component, call `useNotificationSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useNotificationSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNotificationSettingsQuery({
 *   variables: {
 *   },
 * });
 */
export function useNotificationSettingsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(NotificationSettingsDocument, options);
}
export function useNotificationSettingsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(NotificationSettingsDocument, options);
}
export function useNotificationSettingsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(NotificationSettingsDocument, options);
}
export var AccountEnableNotificationChannelDocument = gql(templateObject_100 || (templateObject_100 = __makeTemplateObject(["\n    mutation accountEnableNotificationChannel($input: AccountEnableNotificationChannelInput!) {\n  accountEnableNotificationChannel(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "], ["\n    mutation accountEnableNotificationChannel($input: AccountEnableNotificationChannelInput!) {\n  accountEnableNotificationChannel(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useAccountEnableNotificationChannelMutation__
 *
 * To run a mutation, you first call `useAccountEnableNotificationChannelMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAccountEnableNotificationChannelMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [accountEnableNotificationChannelMutation, { data, loading, error }] = useAccountEnableNotificationChannelMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAccountEnableNotificationChannelMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(AccountEnableNotificationChannelDocument, options);
}
export var AccountDisableNotificationChannelDocument = gql(templateObject_101 || (templateObject_101 = __makeTemplateObject(["\n    mutation accountDisableNotificationChannel($input: AccountDisableNotificationChannelInput!) {\n  accountDisableNotificationChannel(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "], ["\n    mutation accountDisableNotificationChannel($input: AccountDisableNotificationChannelInput!) {\n  accountDisableNotificationChannel(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useAccountDisableNotificationChannelMutation__
 *
 * To run a mutation, you first call `useAccountDisableNotificationChannelMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAccountDisableNotificationChannelMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [accountDisableNotificationChannelMutation, { data, loading, error }] = useAccountDisableNotificationChannelMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAccountDisableNotificationChannelMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(AccountDisableNotificationChannelDocument, options);
}
export var AccountEnableNotificationCategoryDocument = gql(templateObject_102 || (templateObject_102 = __makeTemplateObject(["\n    mutation accountEnableNotificationCategory($input: AccountEnableNotificationCategoryInput!) {\n  accountEnableNotificationCategory(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "], ["\n    mutation accountEnableNotificationCategory($input: AccountEnableNotificationCategoryInput!) {\n  accountEnableNotificationCategory(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useAccountEnableNotificationCategoryMutation__
 *
 * To run a mutation, you first call `useAccountEnableNotificationCategoryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAccountEnableNotificationCategoryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [accountEnableNotificationCategoryMutation, { data, loading, error }] = useAccountEnableNotificationCategoryMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAccountEnableNotificationCategoryMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(AccountEnableNotificationCategoryDocument, options);
}
export var AccountDisableNotificationCategoryDocument = gql(templateObject_103 || (templateObject_103 = __makeTemplateObject(["\n    mutation accountDisableNotificationCategory($input: AccountDisableNotificationCategoryInput!) {\n  accountDisableNotificationCategory(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "], ["\n    mutation accountDisableNotificationCategory($input: AccountDisableNotificationCategoryInput!) {\n  accountDisableNotificationCategory(input: $input) {\n    errors {\n      message\n    }\n    account {\n      id\n      notificationSettings {\n        push {\n          enabled\n          disabledCategories\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useAccountDisableNotificationCategoryMutation__
 *
 * To run a mutation, you first call `useAccountDisableNotificationCategoryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAccountDisableNotificationCategoryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [accountDisableNotificationCategoryMutation, { data, loading, error }] = useAccountDisableNotificationCategoryMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAccountDisableNotificationCategoryMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(AccountDisableNotificationCategoryDocument, options);
}
export var UnacknowledgedNotificationCountDocument = gql(templateObject_104 || (templateObject_104 = __makeTemplateObject(["\n    query UnacknowledgedNotificationCount {\n  me {\n    id\n    unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount\n  }\n}\n    "], ["\n    query UnacknowledgedNotificationCount {\n  me {\n    id\n    unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount\n  }\n}\n    "])));
/**
 * __useUnacknowledgedNotificationCountQuery__
 *
 * To run a query within a React component, call `useUnacknowledgedNotificationCountQuery` and pass it any options that fit your needs.
 * When your component renders, `useUnacknowledgedNotificationCountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useUnacknowledgedNotificationCountQuery({
 *   variables: {
 *   },
 * });
 */
export function useUnacknowledgedNotificationCountQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(UnacknowledgedNotificationCountDocument, options);
}
export function useUnacknowledgedNotificationCountLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(UnacknowledgedNotificationCountDocument, options);
}
export function useUnacknowledgedNotificationCountSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(UnacknowledgedNotificationCountDocument, options);
}
export var SettingsScreenDocument = gql(templateObject_105 || (templateObject_105 = __makeTemplateObject(["\n    query SettingsScreen {\n  me {\n    id\n    username\n    language\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n    totpEnabled\n    phone\n    email {\n      address\n      verified\n    }\n  }\n}\n    "], ["\n    query SettingsScreen {\n  me {\n    id\n    username\n    language\n    defaultAccount {\n      id\n      defaultWalletId\n      wallets {\n        id\n        balance\n        walletCurrency\n      }\n    }\n    totpEnabled\n    phone\n    email {\n      address\n      verified\n    }\n  }\n}\n    "])));
/**
 * __useSettingsScreenQuery__
 *
 * To run a query within a React component, call `useSettingsScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useSettingsScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSettingsScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useSettingsScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(SettingsScreenDocument, options);
}
export function useSettingsScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(SettingsScreenDocument, options);
}
export function useSettingsScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(SettingsScreenDocument, options);
}
export var ExportCsvSettingDocument = gql(templateObject_106 || (templateObject_106 = __makeTemplateObject(["\n    query ExportCsvSetting($walletIds: [WalletId!]!) {\n  me {\n    id\n    defaultAccount {\n      id\n      csvTransactions(walletIds: $walletIds)\n    }\n  }\n}\n    "], ["\n    query ExportCsvSetting($walletIds: [WalletId!]!) {\n  me {\n    id\n    defaultAccount {\n      id\n      csvTransactions(walletIds: $walletIds)\n    }\n  }\n}\n    "])));
/**
 * __useExportCsvSettingQuery__
 *
 * To run a query within a React component, call `useExportCsvSettingQuery` and pass it any options that fit your needs.
 * When your component renders, `useExportCsvSettingQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useExportCsvSettingQuery({
 *   variables: {
 *      walletIds: // value for 'walletIds'
 *   },
 * });
 */
export function useExportCsvSettingQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(ExportCsvSettingDocument, options);
}
export function useExportCsvSettingLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(ExportCsvSettingDocument, options);
}
export function useExportCsvSettingSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(ExportCsvSettingDocument, options);
}
export var UserTotpDeleteDocument = gql(templateObject_107 || (templateObject_107 = __makeTemplateObject(["\n    mutation userTotpDelete {\n  userTotpDelete {\n    errors {\n      message\n    }\n    me {\n      id\n      phone\n      totpEnabled\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "], ["\n    mutation userTotpDelete {\n  userTotpDelete {\n    errors {\n      message\n    }\n    me {\n      id\n      phone\n      totpEnabled\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "])));
/**
 * __useUserTotpDeleteMutation__
 *
 * To run a mutation, you first call `useUserTotpDeleteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserTotpDeleteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userTotpDeleteMutation, { data, loading, error }] = useUserTotpDeleteMutation({
 *   variables: {
 *   },
 * });
 */
export function useUserTotpDeleteMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserTotpDeleteDocument, options);
}
export var AccountLimitsDocument = gql(templateObject_108 || (templateObject_108 = __makeTemplateObject(["\n    query accountLimits {\n  me {\n    id\n    defaultAccount {\n      id\n      limits {\n        withdrawal {\n          totalLimit\n          remainingLimit\n          interval\n        }\n        internalSend {\n          totalLimit\n          remainingLimit\n          interval\n        }\n        convert {\n          totalLimit\n          remainingLimit\n          interval\n        }\n      }\n    }\n  }\n}\n    "], ["\n    query accountLimits {\n  me {\n    id\n    defaultAccount {\n      id\n      limits {\n        withdrawal {\n          totalLimit\n          remainingLimit\n          interval\n        }\n        internalSend {\n          totalLimit\n          remainingLimit\n          interval\n        }\n        convert {\n          totalLimit\n          remainingLimit\n          interval\n        }\n      }\n    }\n  }\n}\n    "])));
/**
 * __useAccountLimitsQuery__
 *
 * To run a query within a React component, call `useAccountLimitsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAccountLimitsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAccountLimitsQuery({
 *   variables: {
 *   },
 * });
 */
export function useAccountLimitsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(AccountLimitsDocument, options);
}
export function useAccountLimitsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(AccountLimitsDocument, options);
}
export function useAccountLimitsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(AccountLimitsDocument, options);
}
export var UserLoginUpgradeTelegramDocument = gql(templateObject_109 || (templateObject_109 = __makeTemplateObject(["\n    mutation userLoginUpgradeTelegram($input: UserLoginUpgradeTelegramInput!) {\n  userLoginUpgradeTelegram(input: $input) {\n    errors {\n      message\n      code\n    }\n    success\n  }\n}\n    "], ["\n    mutation userLoginUpgradeTelegram($input: UserLoginUpgradeTelegramInput!) {\n  userLoginUpgradeTelegram(input: $input) {\n    errors {\n      message\n      code\n    }\n    success\n  }\n}\n    "])));
/**
 * __useUserLoginUpgradeTelegramMutation__
 *
 * To run a mutation, you first call `useUserLoginUpgradeTelegramMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserLoginUpgradeTelegramMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userLoginUpgradeTelegramMutation, { data, loading, error }] = useUserLoginUpgradeTelegramMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserLoginUpgradeTelegramMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserLoginUpgradeTelegramDocument, options);
}
export var TotpRegistrationScreenDocument = gql(templateObject_110 || (templateObject_110 = __makeTemplateObject(["\n    query totpRegistrationScreen {\n  me {\n    id\n    username\n  }\n}\n    "], ["\n    query totpRegistrationScreen {\n  me {\n    id\n    username\n  }\n}\n    "])));
/**
 * __useTotpRegistrationScreenQuery__
 *
 * To run a query within a React component, call `useTotpRegistrationScreenQuery` and pass it any options that fit your needs.
 * When your component renders, `useTotpRegistrationScreenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTotpRegistrationScreenQuery({
 *   variables: {
 *   },
 * });
 */
export function useTotpRegistrationScreenQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(TotpRegistrationScreenDocument, options);
}
export function useTotpRegistrationScreenLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(TotpRegistrationScreenDocument, options);
}
export function useTotpRegistrationScreenSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(TotpRegistrationScreenDocument, options);
}
export var UserTotpRegistrationInitiateDocument = gql(templateObject_111 || (templateObject_111 = __makeTemplateObject(["\n    mutation userTotpRegistrationInitiate {\n  userTotpRegistrationInitiate {\n    errors {\n      message\n    }\n    totpRegistrationId\n    totpSecret\n  }\n}\n    "], ["\n    mutation userTotpRegistrationInitiate {\n  userTotpRegistrationInitiate {\n    errors {\n      message\n    }\n    totpRegistrationId\n    totpSecret\n  }\n}\n    "])));
/**
 * __useUserTotpRegistrationInitiateMutation__
 *
 * To run a mutation, you first call `useUserTotpRegistrationInitiateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserTotpRegistrationInitiateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userTotpRegistrationInitiateMutation, { data, loading, error }] = useUserTotpRegistrationInitiateMutation({
 *   variables: {
 *   },
 * });
 */
export function useUserTotpRegistrationInitiateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserTotpRegistrationInitiateDocument, options);
}
export var UserTotpRegistrationValidateDocument = gql(templateObject_112 || (templateObject_112 = __makeTemplateObject(["\n    mutation userTotpRegistrationValidate($input: UserTotpRegistrationValidateInput!) {\n  userTotpRegistrationValidate(input: $input) {\n    errors {\n      message\n    }\n    me {\n      id\n      totpEnabled\n      phone\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "], ["\n    mutation userTotpRegistrationValidate($input: UserTotpRegistrationValidateInput!) {\n  userTotpRegistrationValidate(input: $input) {\n    errors {\n      message\n    }\n    me {\n      id\n      totpEnabled\n      phone\n      email {\n        address\n        verified\n      }\n    }\n  }\n}\n    "])));
/**
 * __useUserTotpRegistrationValidateMutation__
 *
 * To run a mutation, you first call `useUserTotpRegistrationValidateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUserTotpRegistrationValidateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [userTotpRegistrationValidateMutation, { data, loading, error }] = useUserTotpRegistrationValidateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUserTotpRegistrationValidateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(UserTotpRegistrationValidateDocument, options);
}
export var TransactionListForDefaultAccountDocument = gql(templateObject_113 || (templateObject_113 = __makeTemplateObject(["\n    query transactionListForDefaultAccount($first: Int, $after: String, $walletIds: [WalletId!]) {\n  me {\n    id\n    defaultAccount {\n      id\n      pendingIncomingTransactions {\n        ...Transaction\n      }\n      transactions(first: $first, after: $after, walletIds: $walletIds) {\n        ...TransactionList\n      }\n    }\n  }\n}\n    ", "\n", ""], ["\n    query transactionListForDefaultAccount($first: Int, $after: String, $walletIds: [WalletId!]) {\n  me {\n    id\n    defaultAccount {\n      id\n      pendingIncomingTransactions {\n        ...Transaction\n      }\n      transactions(first: $first, after: $after, walletIds: $walletIds) {\n        ...TransactionList\n      }\n    }\n  }\n}\n    ", "\n", ""])), TransactionFragmentDoc, TransactionListFragmentDoc);
/**
 * __useTransactionListForDefaultAccountQuery__
 *
 * To run a query within a React component, call `useTransactionListForDefaultAccountQuery` and pass it any options that fit your needs.
 * When your component renders, `useTransactionListForDefaultAccountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTransactionListForDefaultAccountQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      walletIds: // value for 'walletIds'
 *   },
 * });
 */
export function useTransactionListForDefaultAccountQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(TransactionListForDefaultAccountDocument, options);
}
export function useTransactionListForDefaultAccountLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(TransactionListForDefaultAccountDocument, options);
}
export function useTransactionListForDefaultAccountSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(TransactionListForDefaultAccountDocument, options);
}
export var DeviceNotificationTokenCreateDocument = gql(templateObject_114 || (templateObject_114 = __makeTemplateObject(["\n    mutation deviceNotificationTokenCreate($input: DeviceNotificationTokenCreateInput!) {\n  deviceNotificationTokenCreate(input: $input) {\n    errors {\n      message\n    }\n    success\n  }\n}\n    "], ["\n    mutation deviceNotificationTokenCreate($input: DeviceNotificationTokenCreateInput!) {\n  deviceNotificationTokenCreate(input: $input) {\n    errors {\n      message\n    }\n    success\n  }\n}\n    "])));
/**
 * __useDeviceNotificationTokenCreateMutation__
 *
 * To run a mutation, you first call `useDeviceNotificationTokenCreateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeviceNotificationTokenCreateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deviceNotificationTokenCreateMutation, { data, loading, error }] = useDeviceNotificationTokenCreateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useDeviceNotificationTokenCreateMutation(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useMutation(DeviceNotificationTokenCreateDocument, options);
}
export var WalletsDocument = gql(templateObject_115 || (templateObject_115 = __makeTemplateObject(["\n    query wallets {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        walletCurrency\n        id\n      }\n    }\n  }\n}\n    "], ["\n    query wallets {\n  me {\n    id\n    defaultAccount {\n      id\n      wallets {\n        walletCurrency\n        id\n      }\n    }\n  }\n}\n    "])));
/**
 * __useWalletsQuery__
 *
 * To run a query within a React component, call `useWalletsQuery` and pass it any options that fit your needs.
 * When your component renders, `useWalletsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useWalletsQuery({
 *   variables: {
 *   },
 * });
 */
export function useWalletsQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useQuery(WalletsDocument, options);
}
export function useWalletsLazyQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useLazyQuery(WalletsDocument, options);
}
export function useWalletsSuspenseQuery(baseOptions) {
    var options = __assign(__assign({}, defaultOptions), baseOptions);
    return Apollo.useSuspenseQuery(WalletsDocument, options);
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29, templateObject_30, templateObject_31, templateObject_32, templateObject_33, templateObject_34, templateObject_35, templateObject_36, templateObject_37, templateObject_38, templateObject_39, templateObject_40, templateObject_41, templateObject_42, templateObject_43, templateObject_44, templateObject_45, templateObject_46, templateObject_47, templateObject_48, templateObject_49, templateObject_50, templateObject_51, templateObject_52, templateObject_53, templateObject_54, templateObject_55, templateObject_56, templateObject_57, templateObject_58, templateObject_59, templateObject_60, templateObject_61, templateObject_62, templateObject_63, templateObject_64, templateObject_65, templateObject_66, templateObject_67, templateObject_68, templateObject_69, templateObject_70, templateObject_71, templateObject_72, templateObject_73, templateObject_74, templateObject_75, templateObject_76, templateObject_77, templateObject_78, templateObject_79, templateObject_80, templateObject_81, templateObject_82, templateObject_83, templateObject_84, templateObject_85, templateObject_86, templateObject_87, templateObject_88, templateObject_89, templateObject_90, templateObject_91, templateObject_92, templateObject_93, templateObject_94, templateObject_95, templateObject_96, templateObject_97, templateObject_98, templateObject_99, templateObject_100, templateObject_101, templateObject_102, templateObject_103, templateObject_104, templateObject_105, templateObject_106, templateObject_107, templateObject_108, templateObject_109, templateObject_110, templateObject_111, templateObject_112, templateObject_113, templateObject_114, templateObject_115;
//# sourceMappingURL=generated.js.map