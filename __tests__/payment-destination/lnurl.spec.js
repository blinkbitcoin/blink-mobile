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
import { getParams } from "js-lnurl";
import { requestPayServiceParams } from "lnurl-pay";
import { createLnurlPaymentDestination, resolveLnurlDestination, } from "@app/screens/send-bitcoin-screen/payment-destination";
import { DestinationDirection } from "@app/screens/send-bitcoin-screen/payment-destination/index.types";
import { createLnurlPaymentDetails } from "@app/screens/send-bitcoin-screen/payment-details";
import { ZeroBtcMoneyAmount } from "@app/types/amounts";
import { PaymentType } from "@blinkbitcoin/blink-client";
import { defaultPaymentDetailParams } from "./helpers";
jest.mock("lnurl-pay", function () { return ({
    requestPayServiceParams: jest.fn(),
}); });
jest.mock("js-lnurl", function () { return ({
    getParams: jest.fn(),
}); });
jest.mock("@app/screens/send-bitcoin-screen/payment-details", function () { return ({
    createLnurlPaymentDetails: jest.fn(),
}); });
var mockRequestPayServiceParams = requestPayServiceParams;
var mockGetParams = getParams;
var mockCreateLnurlPaymentDetail = createLnurlPaymentDetails;
var throwError = function () {
    throw new Error("test error");
};
// Manual mocks for LnUrlPayServiceResponse and LNURLResponse
var manualMockLnUrlPayServiceResponse = function (identifier) { return ({
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
var manualMockLNURLResponse = function () { return ({
    status: "string",
    reason: "string",
    domain: "string",
    url: "string",
}); };
var manualMockLNURLWithdrawParams = function () { return ({
    // Example structure. Adjust according to your actual LNURLWithdrawParams type
    tag: "withdrawRequest",
    k1: "some_random_string",
    callback: "http://example.com/callback",
    domain: "example.com",
    maxWithdrawable: 2000,
    minWithdrawable: 0,
    defaultDescription: "Test withdraw",
    // ... add other required properties
}); };
describe("resolve lnurl destination", function () {
    describe("with ln address", function () {
        var lnurlPaymentDestinationParams = {
            parsedLnurlDestination: {
                paymentType: PaymentType.Lnurl,
                valid: true,
                lnurl: "test@domain.com",
                isMerchant: false,
            },
            lnurlDomains: ["ourdomain.com"],
            accountDefaultWalletQuery: jest.fn(),
            myWalletIds: ["testwalletid"],
        };
        it("creates lnurl pay destination", function () { return __awaiter(void 0, void 0, void 0, function () {
            var lnurlPayParams, destination;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lnurlPayParams = manualMockLnUrlPayServiceResponse(lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl);
                        mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams);
                        mockGetParams.mockResolvedValue(manualMockLNURLResponse());
                        return [4 /*yield*/, resolveLnurlDestination(lnurlPaymentDestinationParams)];
                    case 1:
                        destination = _a.sent();
                        expect(destination).toEqual(expect.objectContaining({
                            valid: true,
                            destinationDirection: DestinationDirection.Send,
                            validDestination: __assign(__assign({}, lnurlPaymentDestinationParams.parsedLnurlDestination), { lnurlParams: lnurlPayParams, valid: true }),
                        }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("with lnurl pay string", function () {
        var lnurlPaymentDestinationParams = {
            parsedLnurlDestination: {
                paymentType: PaymentType.Lnurl,
                valid: true,
                lnurl: "lnurlrandomstring",
                isMerchant: false,
            },
            lnurlDomains: ["ourdomain.com"],
            accountDefaultWalletQuery: jest.fn(),
            myWalletIds: ["testwalletid"],
        };
        it("creates lnurl pay destination", function () { return __awaiter(void 0, void 0, void 0, function () {
            var lnurlPayParams, destination;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lnurlPayParams = manualMockLnUrlPayServiceResponse(lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl);
                        mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams);
                        mockGetParams.mockResolvedValue(manualMockLNURLResponse());
                        return [4 /*yield*/, resolveLnurlDestination(lnurlPaymentDestinationParams)];
                    case 1:
                        destination = _a.sent();
                        expect(destination).toEqual(expect.objectContaining({
                            valid: true,
                            destinationDirection: DestinationDirection.Send,
                            validDestination: __assign(__assign({}, lnurlPaymentDestinationParams.parsedLnurlDestination), { lnurlParams: lnurlPayParams, valid: true }),
                        }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("with lnurl withdraw string", function () {
        var lnurlPaymentDestinationParams = {
            parsedLnurlDestination: {
                paymentType: PaymentType.Lnurl,
                valid: true,
                lnurl: "lnurlrandomstring",
                isMerchant: false,
            },
            lnurlDomains: ["ourdomain.com"],
            accountDefaultWalletQuery: jest.fn(),
            myWalletIds: ["testwalletid"],
        };
        it("creates lnurl withdraw destination", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockLnurlWithdrawParams, destination, callback, domain, k1, maxWithdrawable, minWithdrawable, defaultDescription;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockRequestPayServiceParams.mockImplementation(throwError);
                        mockLnurlWithdrawParams = manualMockLNURLWithdrawParams();
                        mockGetParams.mockResolvedValue(mockLnurlWithdrawParams);
                        return [4 /*yield*/, resolveLnurlDestination(lnurlPaymentDestinationParams)];
                    case 1:
                        destination = _a.sent();
                        callback = mockLnurlWithdrawParams.callback, domain = mockLnurlWithdrawParams.domain, k1 = mockLnurlWithdrawParams.k1, maxWithdrawable = mockLnurlWithdrawParams.maxWithdrawable, minWithdrawable = mockLnurlWithdrawParams.minWithdrawable, defaultDescription = mockLnurlWithdrawParams.defaultDescription;
                        expect(destination).toEqual(expect.objectContaining({
                            valid: true,
                            destinationDirection: DestinationDirection.Receive,
                            validDestination: {
                                paymentType: PaymentType.Lnurl,
                                callback: callback,
                                domain: domain,
                                k1: k1,
                                maxWithdrawable: maxWithdrawable,
                                minWithdrawable: minWithdrawable,
                                defaultDescription: defaultDescription,
                                valid: true,
                                lnurl: lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl,
                            },
                        }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
describe("create lnurl destination", function () {
    it("correctly creates payment detail", function () {
        var manualMockLnUrlPayServiceResponse = {
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
            identifier: "testlnurl",
            description: "mocked_description",
            image: "mocked_image_url",
            commentAllowed: 140,
            rawData: {},
        };
        var lnurlPaymentDestinationParams = {
            paymentType: "lnurl",
            valid: true,
            lnurl: "testlnurl",
            isMerchant: false,
            lnurlParams: manualMockLnUrlPayServiceResponse,
        };
        var lnurlPayDestination = createLnurlPaymentDestination(lnurlPaymentDestinationParams);
        lnurlPayDestination.createPaymentDetail(defaultPaymentDetailParams);
        expect(mockCreateLnurlPaymentDetail).toBeCalledWith({
            lnurl: lnurlPaymentDestinationParams.lnurl,
            lnurlParams: lnurlPaymentDestinationParams.lnurlParams,
            unitOfAccountAmount: ZeroBtcMoneyAmount,
            convertMoneyAmount: defaultPaymentDetailParams.convertMoneyAmount,
            sendingWalletDescriptor: defaultPaymentDetailParams.sendingWalletDescriptor,
            destinationSpecifiedMemo: lnurlPaymentDestinationParams.lnurlParams.description,
            isMerchant: false,
        });
    });
});
//# sourceMappingURL=lnurl.spec.js.map