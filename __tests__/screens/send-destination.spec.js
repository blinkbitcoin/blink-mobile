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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import React from "react";
import { View } from "react-native";
import { it } from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import SendBitcoinDestinationScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-destination-screen";
import { DestinationDirection, InvalidDestinationReason, } from "@app/screens/send-bitcoin-screen/payment-destination/index.types";
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination";
import { InvalidIntraledgerReason, InvalidOnchainDestinationReason, PaymentType, } from "@blinkbitcoin/blink-client";
import { ContextForScreen } from "./helper";
var flushAsync = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, new Promise(function (resolve) {
                                    setTimeout(function () {
                                        resolve();
                                    }, 0);
                                })];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var mockedDestinationData = {
    globals: { network: "mainnet" },
    me: {
        id: "mocked-user-id",
        defaultAccount: {
            id: "mocked-account-id",
            wallets: [{ id: "btc-wallet-id" }],
        },
        contacts: [],
    },
};
jest.mock("@app/graphql/generated", function () { return (__assign(__assign({}, jest.requireActual("@app/graphql/generated")), { useSendBitcoinDestinationQuery: jest.fn(function () { return ({
        loading: false,
        data: mockedDestinationData,
    }); }), useRealtimePriceQuery: jest.fn(function () { return ({}); }), useAccountDefaultWalletLazyQuery: jest.fn(function () { return [jest.fn()]; }) })); });
jest.mock("@app/screens/send-bitcoin-screen/payment-destination", function () { return (__assign(__assign({}, jest.requireActual("@app/screens/send-bitcoin-screen/payment-destination")), { parseDestination: jest.fn() })); });
jest.mock("@app/hooks/use-device-location", function () { return ({
    __esModule: true,
    default: function () { return ({ countryCode: "SV", loading: false }); },
}); });
jest.mock("@app/hooks/use-app-config", function () { return ({
    useAppConfig: function () { return ({
        appConfig: {
            galoyInstance: { lnAddressHostname: "blink.sv", name: "Blink" },
        },
    }); },
}); });
jest.mock("@react-native-clipboard/clipboard", function () { return ({
    getString: jest.fn(function () { return Promise.resolve("clipboard"); }),
    setString: jest.fn(),
}); });
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: function () { return ({
        navigate: jest.fn(),
    }); } })); });
var sendBitcoinDestination = {
    name: "sendBitcoinDestination",
    key: "sendBitcoinDestination",
    params: {
        payment: "",
        username: "",
    },
};
describe("SendBitcoinDestinationScreen", function () {
    var LL;
    var parseDestinationMock = parseDestination;
    beforeEach(function () {
        jest.clearAllMocks();
        loadLocale("en");
        LL = i18nObject("en");
        mockedDestinationData = {
            globals: { network: "mainnet" },
            me: {
                id: "mocked-user-id",
                defaultAccount: {
                    id: "mocked-account-id",
                    wallets: [{ id: "btc-wallet-id" }],
                },
                contacts: [],
            },
        };
    });
    var createLnurlPayParams = function (identifier) { return ({
        callback: "mocked_callback",
        fixed: true,
        min: 0,
        max: 2000,
        domain: "example.com",
        metadata: [
            ["text/plain", "description"],
            ["image/png;base64", "base64EncodedImage"],
        ],
        metadataHash: "mocked_metadata_hash",
        identifier: identifier,
        description: "mocked_description",
        image: "mocked_image_url",
        commentAllowed: 140,
        rawData: {},
    }); };
    var getResponderByLabel = function (label) {
        var responders = screen
            .UNSAFE_getAllByType(View)
            .filter(function (node) { return typeof node.props.onResponderRelease === "function"; });
        var match = responders.find(function (node) { return within(node).queryByLabelText(label); });
        if (!match) {
            throw new Error("Responder not found for label: ".concat(label));
        }
        return match;
    };
    var createUsernameDoesNotExistResult = function (handle) {
        var invalidPaymentDestination = {
            valid: false,
            paymentType: PaymentType.Intraledger,
            invalidReason: InvalidIntraledgerReason.WrongDomain,
            handle: handle,
        };
        return {
            valid: false,
            invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
            invalidPaymentDestination: invalidPaymentDestination,
        };
    };
    var createInvalidAmountResult = function () {
        var invalidPaymentDestination = {
            valid: false,
            paymentType: PaymentType.Onchain,
            invalidReason: InvalidOnchainDestinationReason.InvalidAmount,
        };
        return {
            valid: false,
            invalidReason: InvalidDestinationReason.InvalidAmount,
            invalidPaymentDestination: invalidPaymentDestination,
        };
    };
    it.each([
        {
            name: "shows confirm modal for a new phone destination",
            contacts: [],
            shouldShowModal: true,
        },
        {
            name: "does not show confirm modal for a known phone destination",
            contacts: [
                {
                    id: "contact-id",
                    handle: "+50370000000",
                    username: "+50370000000",
                    alias: null,
                    transactionsCount: 1,
                },
            ],
            shouldShowModal: false,
        },
    ])("$name", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var modalTitle, _c;
        var contacts = _b.contacts, shouldShowModal = _b.shouldShowModal;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    mockedDestinationData = __assign(__assign({}, mockedDestinationData), { me: __assign(__assign({}, mockedDestinationData.me), { contacts: contacts }) });
                    parseDestinationMock.mockResolvedValue({
                        valid: true,
                        destinationDirection: DestinationDirection.Send,
                        validDestination: {
                            valid: true,
                            paymentType: PaymentType.Lnurl,
                            lnurl: "lnurl",
                            isMerchant: false,
                            lnurlParams: createLnurlPayParams("+50370000000"),
                        },
                        createPaymentDetail: jest.fn(),
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText("telephoneNumber"), "70000000");
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _d.sent();
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 2:
                    _d.sent();
                    modalTitle = LL.SendBitcoinDestinationScreen.confirmUsernameModal.title();
                    if (!shouldShowModal) return [3 /*break*/, 4];
                    _c = expect;
                    return [4 /*yield*/, screen.findByText(modalTitle)];
                case 3:
                    _c.apply(void 0, [_d.sent()]).toBeTruthy();
                    return [2 /*return*/];
                case 4:
                    expect(screen.queryByText(modalTitle)).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it.each([
        {
            name: "shows invalid phone error for malformed numbers",
            input: "123",
            shouldCallParse: false,
            expectedError: "invalid",
        },
        {
            name: "accepts valid phone numbers",
            input: "70000000",
            shouldCallParse: true,
            expectedError: "none",
        },
    ])("$name", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c;
        var input = _b.input, shouldCallParse = _b.shouldCallParse, expectedError = _b.expectedError;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    parseDestinationMock.mockResolvedValue({
                        valid: true,
                        destinationDirection: DestinationDirection.Send,
                        validDestination: {
                            valid: true,
                            paymentType: PaymentType.Lnurl,
                            lnurl: "lnurl",
                            isMerchant: false,
                            lnurlParams: createLnurlPayParams(input),
                        },
                        createPaymentDetail: jest.fn(),
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText("telephoneNumber"), input);
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _d.sent();
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 2:
                    _d.sent();
                    if (!(expectedError === "invalid")) return [3 /*break*/, 4];
                    _c = expect;
                    return [4 /*yield*/, screen.findByText(LL.SendBitcoinDestinationScreen.invalidPhoneNumber())];
                case 3:
                    _c.apply(void 0, [_d.sent()]).toBeTruthy();
                    _d.label = 4;
                case 4:
                    if (expectedError === "none") {
                        expect(screen.queryByText(LL.SendBitcoinDestinationScreen.invalidPhoneNumber())).toBeNull();
                    }
                    if (shouldCallParse) {
                        expect(parseDestinationMock).toHaveBeenCalled();
                        return [2 /*return*/];
                    }
                    expect(parseDestinationMock).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it.each([
        {
            name: "rejects phone numbers in the search input",
            input: "123456",
            expectPhoneNotAllowed: true,
        },
        {
            name: "accepts usernames in the search input",
            input: "newuser",
            expectPhoneNotAllowed: false,
        },
    ])("$name", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var phoneNotAllowed, _c;
        var input = _b.input, expectPhoneNotAllowed = _b.expectPhoneNotAllowed;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    parseDestinationMock.mockResolvedValue({
                        valid: true,
                        destinationDirection: DestinationDirection.Send,
                        validDestination: {
                            valid: true,
                            paymentType: PaymentType.Intraledger,
                            handle: input,
                            walletId: "wallet-id",
                        },
                        createPaymentDetail: jest.fn(),
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), input);
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _d.sent();
                    phoneNotAllowed = LL.SendBitcoinDestinationScreen.phoneNotAllowed();
                    if (!expectPhoneNotAllowed) return [3 /*break*/, 3];
                    _c = expect;
                    return [4 /*yield*/, screen.findByText(phoneNotAllowed)];
                case 2:
                    _c.apply(void 0, [_d.sent()]).toBeTruthy();
                    expect(parseDestinationMock).not.toHaveBeenCalled();
                    return [2 /*return*/];
                case 3:
                    expect(screen.queryByText(phoneNotAllowed)).toBeNull();
                    expect(parseDestinationMock).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it.each([
        {
            name: "shows username does not exist error",
            input: "missinguser",
            result: createUsernameDoesNotExistResult("missinguser"),
            expectedText: function (ll) {
                return ll.SendBitcoinDestinationScreen.usernameDoesNotExist({
                    lnAddress: "missinguser@blink.sv",
                    bankName: "Blink",
                });
            },
        },
        {
            name: "shows invalid amount error",
            input: "btc:invalid",
            result: createInvalidAmountResult(),
            expectedText: function (ll) {
                return ll.SendBitcoinDestinationScreen.invalidAmount();
            },
        },
    ])("$name", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c;
        var input = _b.input, result = _b.result, expectedText = _b.expectedText;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    parseDestinationMock.mockResolvedValue(result);
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), input);
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _d.sent();
                    _c = expect;
                    return [4 /*yield*/, screen.findByText(expectedText(LL))];
                case 2:
                    _c.apply(void 0, [_d.sent()]).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("validates clipboard content when pasting into the search input", function () { return __awaiter(void 0, void 0, void 0, function () {
        var searchResponder, pasteButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    parseDestinationMock.mockResolvedValue({
                        valid: true,
                        destinationDirection: DestinationDirection.Send,
                        validDestination: {
                            valid: true,
                            paymentType: PaymentType.Intraledger,
                            handle: "clipboard",
                            walletId: "wallet-id",
                        },
                        createPaymentDetail: jest.fn(),
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    searchResponder = getResponderByLabel(LL.SendBitcoinScreen.placeholder());
                    pasteButton = within(searchResponder).getByText(LL.common.paste());
                    fireEvent.press(pasteButton);
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _a.sent();
                    expect(parseDestinationMock).toHaveBeenCalledWith(expect.objectContaining({ rawInput: "clipboard" }));
                    return [2 /*return*/];
            }
        });
    }); });
    it.each([
        {
            name: "switches focus to phone when tapping paste on the disabled phone input",
            triggerLabel: "telephoneNumber",
            initialInputLabel: "search",
            initialValue: "alice",
            expectedClearedLabel: "search",
        },
        {
            name: "switches focus to search when tapping paste on the disabled search input",
            triggerLabel: "search",
            initialInputLabel: "phone",
            initialValue: "70000000",
            expectedClearedLabel: "phone",
        },
    ])("$name", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var searchInput, phoneInput, responderLabel, responder;
        var triggerLabel = _b.triggerLabel, initialInputLabel = _b.initialInputLabel, initialValue = _b.initialValue, expectedClearedLabel = _b.expectedClearedLabel;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    render(<ContextForScreen>
          <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
        </ContextForScreen>);
                    searchInput = screen.getByLabelText(LL.SendBitcoinScreen.placeholder());
                    phoneInput = screen.getByLabelText("telephoneNumber");
                    if (initialInputLabel === "search") {
                        fireEvent.changeText(searchInput, initialValue);
                    }
                    if (initialInputLabel === "phone") {
                        fireEvent.changeText(phoneInput, initialValue);
                    }
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _c.sent();
                    responderLabel = triggerLabel === "search" ? LL.SendBitcoinScreen.placeholder() : "telephoneNumber";
                    responder = getResponderByLabel(responderLabel);
                    fireEvent(responder, "onResponderRelease");
                    return [4 /*yield*/, flushAsync()];
                case 2:
                    _c.sent();
                    if (expectedClearedLabel === "search") {
                        expect(searchInput.props.value).toBe("");
                        return [2 /*return*/];
                    }
                    expect(phoneInput.props.value).toBe("");
                    return [2 /*return*/];
            }
        });
    }); });
    it("shows confirm modal only once for the same destination", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handle, lnAddress, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    handle = "newuser";
                    lnAddress = "".concat(handle, "@blink.sv");
                    parseDestinationMock.mockResolvedValue({
                        valid: true,
                        destinationDirection: DestinationDirection.Send,
                        validDestination: {
                            valid: true,
                            paymentType: PaymentType.Intraledger,
                            handle: handle,
                            walletId: "wallet-id",
                        },
                        createPaymentDetail: jest.fn(),
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), handle);
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _b.sent();
                    _a = expect;
                    return [4 /*yield*/, screen.findByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title())];
                case 2:
                    _a.apply(void 0, [_b.sent()]).toBeTruthy();
                    fireEvent.press(screen.getByLabelText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                        lnAddress: lnAddress,
                    })));
                    fireEvent.press(screen.getByLabelText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()));
                    return [4 /*yield*/, flushAsync()];
                case 3:
                    _b.sent();
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 4:
                    _b.sent();
                    expect(screen.queryByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title())).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("shows confirm modal again for a different destination", function () { return __awaiter(void 0, void 0, void 0, function () {
        var firstHandle, secondHandle, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    firstHandle = "newuser";
                    secondHandle = "anotheruser";
                    parseDestinationMock.mockImplementation(function (_a) {
                        var rawInput = _a.rawInput;
                        return Promise.resolve({
                            valid: true,
                            destinationDirection: DestinationDirection.Send,
                            validDestination: {
                                valid: true,
                                paymentType: PaymentType.Intraledger,
                                handle: rawInput,
                                walletId: "wallet-id",
                            },
                            createPaymentDetail: jest.fn(),
                        });
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), firstHandle);
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _b.sent();
                    fireEvent.press(screen.getByLabelText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                        lnAddress: "".concat(firstHandle, "@blink.sv"),
                    })));
                    fireEvent.press(screen.getByLabelText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()));
                    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), secondHandle);
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 2:
                    _b.sent();
                    _a = expect;
                    return [4 /*yield*/, screen.findByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title())];
                case 3:
                    _a.apply(void 0, [_b.sent()]).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not show confirm modal for a known contact", function () { return __awaiter(void 0, void 0, void 0, function () {
        var knownHandle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    knownHandle = "existinguser";
                    mockedDestinationData = __assign(__assign({}, mockedDestinationData), { me: __assign(__assign({}, mockedDestinationData.me), { contacts: [
                                {
                                    id: "contact-id",
                                    handle: knownHandle,
                                    username: knownHandle,
                                    alias: null,
                                    transactionsCount: 1,
                                },
                            ] }) });
                    parseDestinationMock.mockResolvedValue({
                        valid: true,
                        destinationDirection: DestinationDirection.Send,
                        validDestination: {
                            valid: true,
                            paymentType: PaymentType.Intraledger,
                            handle: knownHandle,
                            walletId: "wallet-id",
                        },
                        createPaymentDetail: jest.fn(),
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), knownHandle);
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _a.sent();
                    expect(screen.queryByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title())).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("requires confirmation checkbox before enabling confirm button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handle, lnAddress, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    handle = "newuser";
                    lnAddress = "".concat(handle, "@blink.sv");
                    parseDestinationMock.mockResolvedValue({
                        valid: true,
                        destinationDirection: DestinationDirection.Send,
                        validDestination: {
                            valid: true,
                            paymentType: PaymentType.Intraledger,
                            handle: handle,
                            walletId: "wallet-id",
                        },
                        createPaymentDetail: jest.fn(),
                    });
                    render(<ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination}/>
      </ContextForScreen>);
                    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), handle);
                    fireEvent.press(screen.getByLabelText(LL.common.next()));
                    return [4 /*yield*/, flushAsync()];
                case 1:
                    _b.sent();
                    fireEvent.press(screen.getByLabelText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title())];
                case 2:
                    _a.apply(void 0, [_b.sent()]).toBeTruthy();
                    fireEvent.press(screen.getByLabelText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                        lnAddress: lnAddress,
                    })));
                    fireEvent.press(screen.getByLabelText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()));
                    expect(screen.queryByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title())).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=send-destination.spec.js.map