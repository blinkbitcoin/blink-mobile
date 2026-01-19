import {
  AccountUpdatesDocument,
  CurrencyListDocument,
  DisplayCurrencyDocument,
  HomeAuthedDocument,
  HomeUnauthedDocument,
  LnNoAmountInvoiceCreateDocument,
  MobileUpdateDocument,
  MyLnUpdatesDocument,
  OnChainAddressCurrentDocument,
  PaymentRequestDocument,
  RealtimePriceDocument,
  SendBitcoinConfirmationScreenDocument,
  SendBitcoinDestinationDocument,
  SendBitcoinDetailsScreenDocument,
  UserUpdateUsernameDocument,
  MyUserIdDocument,
  TransactionListForDefaultAccountDocument,
  UserLoginUpgradeTelegramDocument,
} from "./generated"

// TODO: put in __tests__ folder?
// will it work for storybooks?
// should not be in production build
// no harm but will increase bundle size

const mocks = [
  {
    request: {
      query: MobileUpdateDocument,
    },
    result: {
      data: {
        mobileVersions: [
          {
            platform: "android",
            currentSupported: 500,
            minSupported: 400,
          },
          {
            platform: "ios",
            currentSupported: 500,
            minSupported: 400,
          },
        ],
      },
    },
  },
  {
    request: {
      query: AccountUpdatesDocument,
    },
    result: {
      data: {
        myUpdates: {
          __typename: "MyUpdatesPayload",
          update: null,
          errors: [],
          me: null,
        },
      },
    },
  },
  {
    request: {
      query: MyLnUpdatesDocument,
    },
    result: {
      data: {
        myUpdates: {
          update: {},
          errors: {
            message: "",
          },
        },
      },
    },
  },
  {
    request: {
      query: SendBitcoinDestinationDocument,
    },
    result: {
      data: {
        globals: {
          network: "signet",
          __typename: "Globals",
        },
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            wallets: [
              {
                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                __typename: "BTCWallet",
              },
              {
                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          contacts: [
            {
              id: "extheo",
              username: "extheo",
              __typename: "UserContact",
            },
            {
              id: "test",
              username: "test",
              __typename: "UserContact",
            },
            {
              id: "galoytest",
              username: "galoytest",
              __typename: "UserContact",
            },
          ],
          __typename: "User",
        },
      },
    },
  },
  {
    request: {
      query: CurrencyListDocument,
    },
    result: {
      data: {
        currencyList: [
          {
            flag: "🇺🇸",
            id: "USD",
            name: "US Dollar",
            symbol: "$",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇪🇺",
            id: "EUR",
            name: "Euro",
            symbol: "€",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇳🇬",
            id: "NGN",
            name: "Nigerian Naira",
            symbol: "₦",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "",
            id: "XAF",
            name: "CFA Franc BEAC",
            symbol: "FCFA",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇵🇪",
            id: "PEN",
            name: "Peruvian Nuevo Sol",
            symbol: "S/.",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇨🇴",
            id: "COP",
            name: "Colombian Peso",
            symbol: "$",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇧🇷",
            id: "BRL",
            name: "Brazilian Real",
            symbol: "R$",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇬🇹",
            id: "GTQ",
            name: "Guatemalan Quetzal",
            symbol: "Q",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇨🇷",
            id: "CRC",
            name: "Costa Rican Colón",
            symbol: "₡",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇹🇷",
            id: "TRY",
            name: "Turkish Lira",
            symbol: "₤",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇮🇳",
            id: "INR",
            name: "Indian Rupee",
            symbol: "₹",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇹🇹",
            id: "TTD",
            name: "Trinidad and Tobago Dollar",
            symbol: "TT$",
            fractionDigits: 2,
            __typename: "Currency",
          },
        ],
      },
    },
  },
  {
    request: {
      query: DisplayCurrencyDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            displayCurrency: "USD",
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
  {
    request: {
      query: SendBitcoinConfirmationScreenDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
  {
    request: {
      query: SendBitcoinDetailsScreenDocument,
    },
    result: {
      data: {
        globals: {
          network: "mainnet",
          __typename: "Globals",
        },
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            defaultWalletId: "f79792e3-282b-45d4-85d5-7486d020def5",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            defaultWallet: {
              id: "f79792e3-282b-45d4-85d5-7486d020def5",
              walletCurrency: "BTC",
              __typename: "BTCWallet",
            },
            wallets: [
              {
                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                walletCurrency: "BTC",
                balance: 88413,
                __typename: "BTCWallet",
              },
              {
                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                walletCurrency: "USD",
                balance: 158,
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
  {
    request: { query: MyUserIdDocument },
    result: {
      data: {
        me: {
          id: "user-id-123",
          __typename: "User",
        },
      },
    },
  },
  {
    request: {
      query: UserUpdateUsernameDocument,
      variables: {
        input: { username: "validAddress" },
      },
    },
    result: {
      data: {
        userUpdateUsername: {
          errors: [],
          user: {
            id: "user-id-123",
            username: "validAddress",
            __typename: "User",
          },
          __typename: "UserPayload",
        },
      },
    },
  },
  {
    request: {
      query: DisplayCurrencyDocument,
    },
    result: {
      data: {
        me: {
          id: "user-id-123",
          __typename: "User",
          defaultAccount: {
            id: "account-id-123",
            displayCurrency: "USD",
            __typename: "ConsumerAccount",
          },
        },
      },
    },
  },
  {
    request: {
      query: LnNoAmountInvoiceCreateDocument,
      variables: {
        input: { walletId: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8", memo: undefined },
      },
    },
    result: {
      data: {
        lnNoAmountInvoiceCreate: {
          invoice: {
            paymentRequest:
              "lnbc1p3lwh3npp5z5wkmy86gcww9u2h8tuekqmfz4pwlpkk4rfst8cm7jwzm8fklldsdqqcqzpuxqyz5vqsp52fv968tprd3dqkuqsq78nw8s0xr9zn7rx686ukq2rfnsdf27pwtq9qyyssqhc7m7d3gfvdsywx956d3u3h45xyf7xurc6yv5qxysspjnhhxstl3wet525ldxn3x6xd0g58nk6wuvwle0fhn5sul396za3qs5ma7zxsqjvklym",
            paymentHash:
              "0ab7a842956c260e1270a46d09e964ac15e0623d4f2d8d4b62af5a608f4c5e06",
            __typename: "LnNoAmountInvoice",
          },
          errors: [],
          __typename: "LnNoAmountInvoicePayload",
        },
      },
    },
  },
  {
    request: {
      query: DisplayCurrencyDocument,
    },
    result: {
      data: {
        me: {
          __typename: "User",
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            displayCurrency: "EUR",
          },
        },
      },
    },
  },
  {
    request: {
      query: PaymentRequestDocument,
    },
    result: {
      data: {
        globals: {
          __typename: "Globals",
          network: "signet",
          feesInformation: {
            deposit: {
              minBankFee: "3000",
              minBankFeeThreshold: "1000000",
            },
          },
        },
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          username: "test1",
          defaultAccount: {
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            defaultWalletId: "f79792e3-282b-45d4-85d5-7486d020def5",
            wallets: [
              {
                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                balance: 88413,
                walletCurrency: "BTC",
                __typename: "BTCWallet",
              },
              {
                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                balance: 158,
                walletCurrency: "USD",
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
  {
    request: {
      query: OnChainAddressCurrentDocument,
      variables: {
        input: { walletId: "f79792e3-282b-45d4-85d5-7486d020def5" },
      },
    },
    result: {
      data: {
        onChainAddressCurrent: {
          errors: [],
          address: "tb1qstk6xund50xqcrnz7vsly2rke6xpw05pc7lmz5",
        },
      },
    },
  },
  {
    request: {
      query: LnNoAmountInvoiceCreateDocument,
      variables: {
        input: {
          walletId: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
          memo: "Pay to Blink Wallet User",
        },
      },
    },
    result: {
      data: {
        lnNoAmountInvoiceCreate: {
          errors: [],
          invoice: {
            paymentHash:
              "121f799e7fc7758ccb00ccf6ead8166c1585bb98992e2f22070abc1bf12c9345",
            paymentRequest:
              "lntbs1pjt954upp5zg0hn8nlca6cejcqenmw4kqkds2ctwucnyhz7gs8p27phufvjdzsdqqcqzpuxqzfvsp5ctx8tvj2n5mgqjrksy9s8ftt4vf4ymjv09hf4a2stvgjkl7ps9ys9qyyssqhpc4x792tjpj68gs5g9rweff63ajyv4grrk9wp8m84rq747gx8y9g5f8vuutg8em08ns9spxjnf52we54kaqxup095u9n4t7hp8zzpgpwre3fg",
          },
        },
      },
    },
  },
  {
    request: {
      query: LnNoAmountInvoiceCreateDocument,
      variables: {
        input: {
          walletId: "f79792e3-282b-45d4-85d5-7486d020def5",
          memo: "Pay to Blink Wallet User",
        },
      },
    },
    result: {
      data: {
        lnNoAmountInvoiceCreate: {
          errors: [],
          invoice: {
            paymentHash:
              "c2a6e5ca220fde78733f91f8ad2f979daf6009a50e218f6f85fa036bc5772da9",
            paymentRequest:
              "lntbs1pjt95g2pp5c2nwtj3zpl08suelj8u26tuhnkhkqzd9pcsc7mu9lgpkh3th9k5sdqqcqzpuxqzfvsp50gl555nvaln4czxuf65gqeume7uke0c2hf8jyfly8ktkvh0vq4eq9qyyssqcj2ukjdmes4x5zhxty5pfevjf3vtwjds6x7vpcc3layq8hh9k24jl58lw9zugup8wgh9fsgjrwty0g5gga3f94v67s8cv9wr55qhpaqqttp0vx",
          },
        },
      },
    },
  },
  {
    request: {
      query: RealtimePriceDocument,
    },
    result: {
      data: {
        me: {
          __typename: "User",
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            __typename: "Account",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            realtimePrice: {
              btcSatPrice: {
                base: 24015009766,
                offset: 12,
                currencyUnit: "USDCENT",
                __typename: "PriceOfOneSat",
              },
              denominatorCurrency: "NGN",
              id: "67b6e1d2-04c8-509a-abbd-b1cab08575d5",
              timestamp: 1677184189,
              usdCentPrice: {
                base: 100000000,
                offset: 6,
                currencyUnit: "USDCENT",
                __typename: "PriceOfOneUsdCent",
              },
              __typename: "RealtimePrice",
            },
          },
        },
      },
    },
  },
  {
    request: {
      query: HomeUnauthedDocument,
    },
    result: {
      data: {
        __typename: "Query",
        globals: {
          __typename: "Globals",
          network: "mainnet",
        },
        mobileVersions: {
          __typename: "MobileVersions",
          platform: "iOS",
          currentSupported: 100,
          minSupported: 100,
        },
        currencyList: [
          {
            flag: "🇺🇸",
            id: "USD",
            name: "US Dollar",
            symbol: "$",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇪🇺",
            id: "EUR",
            name: "Euro",
            symbol: "€",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇳🇬",
            id: "NGN",
            name: "Nigerian Naira",
            symbol: "₦",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "",
            id: "XAF",
            name: "CFA Franc BEAC",
            symbol: "FCFA",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇵🇪",
            id: "PEN",
            name: "Peruvian Nuevo Sol",
            symbol: "S/.",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇨🇴",
            id: "COP",
            name: "Colombian Peso",
            symbol: "$",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇧🇷",
            id: "BRL",
            name: "Brazilian Real",
            symbol: "R$",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇬🇹",
            id: "GTQ",
            name: "Guatemalan Quetzal",
            symbol: "Q",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇨🇷",
            id: "CRC",
            name: "Costa Rican Colón",
            symbol: "₡",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇹🇷",
            id: "TRY",
            name: "Turkish Lira",
            symbol: "₤",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇮🇳",
            id: "INR",
            name: "Indian Rupee",
            symbol: "₹",
            fractionDigits: 2,
            __typename: "Currency",
          },
          {
            flag: "🇹🇹",
            id: "TTD",
            name: "Trinidad and Tobago Dollar",
            symbol: "TT$",
            fractionDigits: 2,
            __typename: "Currency",
          },
        ],
      },
    },
  },
  {
    request: {
      query: HomeAuthedDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          language: "",
          username: "test1",
          phone: "+50365055539",
          defaultAccount: {
            level: "ONE",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            defaultWalletId: "f79792e3-282b-45d4-85d5-7486d020def5",
            transactions: {
              pageInfo: {
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: "6405acd835ff0f9111e86267",
                endCursor: "63fce5e1b7d1ee432dcc9535",
                __typename: "PageInfo",
              },
              edges: [
                {
                  cursor: "6405acd835ff0f9111e86267",
                  node: {
                    __typename: "Transaction",
                    id: "6405acd835ff0f9111e86267",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1678093528,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-10.32",
                    settlementDisplayCurrency: "NGN",
                    settlementPrice: {
                      base: 10320000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "10.32",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "64037b7535ff0f9111c0fcf0",
                  node: {
                    __typename: "Transaction",
                    id: "64037b7535ff0f9111c0fcf0",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677949813,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-10.28",
                    settlementDisplayCurrency: "NGN",
                    settlementPrice: {
                      base: 10280000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "10.28",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "640377ed35ff0f9111c09ade",
                  node: {
                    __typename: "Transaction",
                    id: "640377ed35ff0f9111c09ade",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677948909,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-10.28",
                    settlementDisplayCurrency: "NGN",
                    settlementPrice: {
                      base: 10280000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "10.28",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "6403697335ff0f9111bf95a3",
                  node: {
                    __typename: "Transaction",
                    id: "6403697335ff0f9111bf95a3",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677945203,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-10.28",
                    settlementDisplayCurrency: "NGN",
                    settlementPrice: {
                      base: 10280000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "10.28",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "64030e5935ff0f9111b90ecc",
                  node: {
                    __typename: "Transaction",
                    id: "64030e5935ff0f9111b90ecc",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677921881,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-10.30",
                    settlementDisplayCurrency: "NGN",
                    settlementPrice: {
                      base: 10300000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "10.3",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "64025d2235ff0f9111ac1642",
                  node: {
                    __typename: "Transaction",
                    id: "64025d2235ff0f9111ac1642",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677876514,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-10.28",
                    settlementDisplayCurrency: "NGN",
                    settlementPrice: {
                      base: 10280000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "10.28",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "6400b9ccb7d1ee432d159707",
                  node: {
                    __typename: "Transaction",
                    id: "6400b9ccb7d1ee432d159707",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677769164,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 20000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fe34fdb7d1ee432de51d23",
                  node: {
                    __typename: "Transaction",
                    id: "63fe34fdb7d1ee432de51d23",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1677604093,
                    settlementAmount: 2,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "USD",
                    settlementDisplayAmount: "0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 1000000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "1",
                      __typename: "Price",
                    },
                    initiationVia: {
                      paymentHash:
                        "34f33b2c30907eb324f2f2128221307e93d3686e8ac71f02b6d8d5679a6b1ad8",
                      __typename: "InitiationViaLn",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fe34efb7d1ee432de51b61",
                  node: {
                    __typename: "Transaction",
                    id: "63fe34efb7d1ee432de51b61",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1677604079,
                    settlementAmount: 150,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "0.04",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 26666666667,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02666666666666667",
                      __typename: "Price",
                    },
                    initiationVia: {
                      paymentHash:
                        "a01b22efb5eb7d16ecd47d6a66bb03682018a572d7cd0e069d5202913b99f58e",
                      __typename: "InitiationViaLn",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fe3409b7d1ee432de50a8b",
                  node: {
                    __typename: "Transaction",
                    id: "63fe3409b7d1ee432de50a8b",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677603849,
                    settlementAmount: -16,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-0.01",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 62500000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.0625",
                      __typename: "Price",
                    },
                    initiationVia: {
                      paymentHash:
                        "58dce20cde9b58b2218bb9a4afe7f213dfc23daa7fc8b478632521646ad8ad20",
                      __typename: "InitiationViaLn",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fe32efb7d1ee432de4f5b1",
                  node: {
                    __typename: "Transaction",
                    id: "63fe32efb7d1ee432de4f5b1",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677603567,
                    settlementAmount: -16,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-0.01",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 62500000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.0625",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fe3287b7d1ee432de4eb90",
                  node: {
                    __typename: "Transaction",
                    id: "63fe3287b7d1ee432de4eb90",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677603463,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 20000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fdb529b7d1ee432ddbc2bb",
                  node: {
                    __typename: "Transaction",
                    id: "63fdb529b7d1ee432ddbc2bb",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1677571369,
                    settlementAmount: 2,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "USD",
                    settlementDisplayAmount: "0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 1000000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "1",
                      __typename: "Price",
                    },
                    initiationVia: {
                      paymentHash:
                        "bff4848dc3e20eb1cb265193d2ff53c41b1aca8ddcc21757e41af842a2e35cef",
                      __typename: "InitiationViaLn",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fdb518b7d1ee432ddbc0eb",
                  node: {
                    __typename: "Transaction",
                    id: "63fdb518b7d1ee432ddbc0eb",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1677571352,
                    settlementAmount: 150,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "0.03",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 20000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02",
                      __typename: "Price",
                    },
                    initiationVia: {
                      paymentHash:
                        "17a6c7d5c7d41c16bfcd0df540c52fbd718d9f4b87a5f823cfad57c176ba012c",
                      __typename: "InitiationViaLn",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fdb50bb7d1ee432ddbbf71",
                  node: {
                    __typename: "Transaction",
                    id: "63fdb50bb7d1ee432ddbbf71",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1677571339,
                    settlementAmount: 91,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 21978021978,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02197802197802198",
                      __typename: "Price",
                    },
                    initiationVia: {
                      paymentHash:
                        "41d8a8701d5c9fac263dbc8a413ebf5409f730e96ca226e0045924c852898e74",
                      __typename: "InitiationViaLn",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fdb246b7d1ee432ddb7ead",
                  node: {
                    __typename: "Transaction",
                    id: "63fdb246b7d1ee432ddb7ead",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1677570630,
                    settlementAmount: 2,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "USD",
                    settlementDisplayAmount: "0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 1000000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "1",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: null,
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: null,
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fdb246b7d1ee432ddb7eaa",
                  node: {
                    __typename: "Transaction",
                    id: "63fdb246b7d1ee432ddb7eaa",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677570630,
                    settlementAmount: -91,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 21978021978,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02197802197802198",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: null,
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: null,
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fdb208b7d1ee432ddb7831",
                  node: {
                    __typename: "Transaction",
                    id: "63fdb208b7d1ee432ddb7831",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677570568,
                    settlementAmount: -91,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 21978021978,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02197802197802198",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fdb189b7d1ee432ddb6b6a",
                  node: {
                    __typename: "Transaction",
                    id: "63fdb189b7d1ee432ddb6b6a",
                    status: "SUCCESS",
                    direction: "SEND",
                    memo: null,
                    createdAt: 1677570441,
                    settlementAmount: -100,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "-0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 20000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "0.02",
                      __typename: "Price",
                    },
                    initiationVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "InitiationViaIntraLedger",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
                {
                  cursor: "63fce5e1b7d1ee432dcc9535",
                  node: {
                    __typename: "Transaction",
                    id: "63fce5e1b7d1ee432dcc9535",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1677518305,
                    settlementAmount: 2,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "USD",
                    settlementDisplayAmount: "0.02",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      base: 1000000000000,
                      offset: 12,
                      currencyUnit: "USDCENT",
                      formattedAmount: "1",
                      __typename: "Price",
                    },
                    initiationVia: {
                      paymentHash:
                        "6d11c30f52d6f56b7ab28f17163bb07355bf483213c917f5d6c78ccb9662ddd9",
                      __typename: "InitiationViaLn",
                    },
                    settlementVia: {
                      counterPartyWalletId: null,
                      counterPartyUsername: "galoytest",
                      __typename: "SettlementViaIntraLedger",
                    },
                  },
                  __typename: "TransactionEdge",
                },
              ],
              __typename: "TransactionConnection",
            },
            wallets: [
              {
                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                balance: 88413,
                walletCurrency: "BTC",
                __typename: "BTCWallet",
              },
              {
                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                balance: 158,
                walletCurrency: "USD",
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
  {
    request: {
      query: TransactionListForDefaultAccountDocument,
      variables: {
        first: 21,
        walletIds: [
          "e821e124-1c70-4aab-9416-074ee5be21f6",
          "5b54bf9a-46cc-4344-b638-b5e5e157a892",
        ],
      },
    },
    newData: () => ({
      data: {
        me: {
          __typename: "User",
          id: "user-id",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "account-id",
            wallets: [
              {
                __typename: "BTCWallet",
                id: "e821e124-1c70-4aab-9416-074ee5be21f6",
                walletCurrency: "BTC",
              },
              {
                __typename: "UsdWallet",
                id: "5b54bf9a-46cc-4344-b638-b5e5e157a892",
                walletCurrency: "USD",
              },
            ],
            pendingIncomingTransactions: [],
            transactions: {
              __typename: "TransactionConnection",
              pageInfo: {
                __typename: "PageInfo",
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: "cursor-1",
                endCursor: "cursor-1",
              },
              edges: [
                {
                  __typename: "TransactionEdge",
                  cursor: "cursor-1",
                  node: {
                    __typename: "Transaction",
                    id: "tx-1",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1700000000,
                    settlementAmount: 1000,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "0.10",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
                      base: 105000000000,
                      offset: 12,
                      currencyUnit: "MINOR",
                      formattedAmount: "0.105",
                    },
                    initiationVia: {
                      __typename: "InitiationViaLn",
                      paymentHash: "hash-1",
                      paymentRequest: "payment-request-1",
                    },
                    settlementVia: {
                      __typename: "SettlementViaIntraLedger",
                      counterPartyWalletId: null,
                      counterPartyUsername: "user_btc",
                      preImage: null,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    }),
  },
  {
    request: {
      query: TransactionListForDefaultAccountDocument,
      variables: {
        first: 21,
        walletIds: [
          "e821e124-1c70-4aab-9416-074ee5be21f6",
          "5b54bf9a-46cc-4344-b638-b5e5e157a892",
        ],
      },
    },
    newData: () => ({
      data: {
        me: {
          __typename: "User",
          id: "user-id-mock",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "account-id-mock",
            wallets: [
              {
                __typename: "BTCWallet",
                id: "e821e124-1c70-4aab-9416-074ee5be21f6",
                walletCurrency: "BTC",
              },
              {
                __typename: "UsdWallet",
                id: "5b54bf9a-46cc-4344-b638-b5e5e157a892",
                walletCurrency: "USD",
              },
            ],
            pendingIncomingTransactions: [],
            transactions: {
              __typename: "TransactionConnection",
              pageInfo: {
                __typename: "PageInfo",
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: "mock-cursor-start",
                endCursor: "mock-cursor-end",
              },
              edges: [
                {
                  __typename: "TransactionEdge",
                  cursor: "mock-cursor-start",
                  node: {
                    __typename: "Transaction",
                    id: "mock-tx-1",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1700000000,
                    settlementAmount: 1000,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "0.10",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
                      base: 105000000000,
                      offset: 12,
                      currencyUnit: "MINOR",
                      formattedAmount: "0.105",
                    },
                    initiationVia: {
                      __typename: "InitiationViaLn",
                      paymentHash: "mock-hash-1",
                      paymentRequest: "mock-payment-request-1",
                    },
                    settlementVia: {
                      __typename: "SettlementViaIntraLedger",
                      counterPartyWalletId: null,
                      counterPartyUsername: "user_btc",
                      preImage: null,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    }),
  },
  {
    request: {
      query: TransactionListForDefaultAccountDocument,
      variables: {
        first: 21,
        walletIds: ["e821e124-1c70-4aab-9416-074ee5be21f6"],
      },
    },
    newData: () => ({
      data: {
        me: {
          __typename: "User",
          id: "user-id-btc",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "account-id-btc",
            pendingIncomingTransactions: [],
            transactions: {
              __typename: "TransactionConnection",
              pageInfo: {
                __typename: "PageInfo",
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: "btc-cursor-start",
                endCursor: "btc-cursor-end",
              },
              edges: [
                {
                  __typename: "TransactionEdge",
                  cursor: "btc-cursor-start",
                  node: {
                    __typename: "Transaction",
                    id: "btc-tx-1",
                    status: "SUCCESS",
                    direction: "RECEIVE",
                    memo: null,
                    createdAt: 1700000000,
                    settlementAmount: 1000,
                    settlementFee: 0,
                    settlementDisplayFee: "0.00",
                    settlementCurrency: "BTC",
                    settlementDisplayAmount: "0.10",
                    settlementDisplayCurrency: "USD",
                    settlementPrice: {
                      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
                      base: 105000000000,
                      offset: 12,
                      currencyUnit: "MINOR",
                      formattedAmount: "0.105",
                    },
                    initiationVia: {
                      __typename: "InitiationViaLn",
                      paymentHash: "btc-hash-1",
                      paymentRequest: "btc-payment-request-1",
                    },
                    settlementVia: {
                      __typename: "SettlementViaIntraLedger",
                      counterPartyWalletId: null,
                      counterPartyUsername: "user_btc",
                      preImage: null,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    }),
  },
  {
    request: {
      query: UserLoginUpgradeTelegramDocument,
      variables: { input: { phone: "+50375000000", nonce: "mocked_nonce" } },
    },
    result: {
      data: {
        userLoginUpgradeTelegram: {
          success: true,
          authToken: "test-token",
          totpRequired: false,
          errors: [],
          __typename: "UserLoginUpgradeTelegramPayload",
        },
      },
    },
  },
]

// queries are been consumed when they are used by MockedProvider
// so they are duplicated here for now
// export default mocks
export default [...mocks, ...mocks, ...mocks, ...mocks, ...mocks, ...mocks]
