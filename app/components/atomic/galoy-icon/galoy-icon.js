import React from "react";
import { View } from "react-native";
import ArrowLeft from "@app/assets/icons-redesign/arrow-left.svg";
import ArrowRight from "@app/assets/icons-redesign/arrow-right.svg";
import BackSpace from "@app/assets/icons-redesign/back-space.svg";
import Bank from "@app/assets/icons-redesign/bank.svg";
import Bell from "@app/assets/icons-redesign/bell.svg";
import Bitcoin from "@app/assets/icons-redesign/bitcoin.svg";
import Book from "@app/assets/icons-redesign/book.svg";
import BtcBook from "@app/assets/icons-redesign/btc-book.svg";
import CaretDown from "@app/assets/icons-redesign/caret-down.svg";
import CaretLeft from "@app/assets/icons-redesign/caret-left.svg";
import CaretRight from "@app/assets/icons-redesign/caret-right.svg";
import CaretUp from "@app/assets/icons-redesign/caret-up.svg";
import CheckCircle from "@app/assets/icons-redesign/check-circle.svg";
import Check from "@app/assets/icons-redesign/check.svg";
import CloseCrossWithBackground from "@app/assets/icons-redesign/close-cross-with-background.svg";
import Close from "@app/assets/icons-redesign/close.svg";
import Coins from "@app/assets/icons-redesign/coins.svg";
import CopyPaste from "@app/assets/icons-redesign/copy-paste.svg";
import Dollar from "@app/assets/icons-redesign/dollar.svg";
import EyeSlash from "@app/assets/icons-redesign/eye-slash.svg";
import Eye from "@app/assets/icons-redesign/eye.svg";
import Filter from "@app/assets/icons-redesign/filter.svg";
import Globe from "@app/assets/icons-redesign/globe.svg";
import Graph from "@app/assets/icons-redesign/graph.svg";
import Image from "@app/assets/icons-redesign/image.svg";
import Info from "@app/assets/icons-redesign/info.svg";
import Lightning from "@app/assets/icons-redesign/lightning.svg";
import LightningAddress from "@app/assets/icons-redesign/lightning-address.svg";
import Link from "@app/assets/icons-redesign/link.svg";
import Loading from "@app/assets/icons-redesign/loading.svg";
import EmailAdd from "@app/assets/icons-redesign/email-add.svg";
import MagnifyingGlass from "@app/assets/icons-redesign/magnifying-glass.svg";
import Map from "@app/assets/icons-redesign/map.svg";
import Menu from "@app/assets/icons-redesign/menu.svg";
import PaymentError from "@app/assets/icons-redesign/payment-error.svg";
import PaymentPending from "@app/assets/icons-redesign/payment-pending.svg";
import PaymentSuccess from "@app/assets/icons-redesign/payment-success.svg";
import Pencil from "@app/assets/icons-redesign/pencil.svg";
import QrCode from "@app/assets/icons-redesign/qr-code.svg";
import Question from "@app/assets/icons-redesign/question.svg";
import Receive from "@app/assets/icons-redesign/receive.svg";
import Send from "@app/assets/icons-redesign/send.svg";
import Settings from "@app/assets/icons-redesign/settings.svg";
import Support from "@app/assets/icons-redesign/support.svg";
import Share from "@app/assets/icons-redesign/share.svg";
import Transfer from "@app/assets/icons-redesign/transfer.svg";
import User from "@app/assets/icons-redesign/user.svg";
import Video from "@app/assets/icons-redesign/video.svg";
import WarningWithBackground from "@app/assets/icons-redesign/warning-with-background.svg";
import Warning from "@app/assets/icons-redesign/warning.svg";
import Telegram from "@app/assets/icons/telegram.svg";
import TelegramSimple from "@app/assets/icons-redesign/telegram-simple.svg";
import Note from "@app/assets/icons/note.svg";
import People from "@app/assets/icons/people.svg";
import Rank from "@app/assets/icons/rank.svg";
import Refresh from "@app/assets/icons/refresh.svg";
import Upgrade from "@app/assets/icons-redesign/upgrade.svg";
import Welcome from "@app/assets/icons-redesign/welcome.svg";
import Calculator from "@app/assets/icons-redesign/calculator.svg";
import DocumentIcon from "@app/assets/icons-redesign/document.svg";
import KeyIcon from "@app/assets/icons-redesign/key.svg";
import HouseIcon from "@app/assets/icons-redesign/house-outline.svg";
import Headset from "@app/assets/icons-redesign/headset.svg";
import { makeStyles, useTheme } from "@rn-vui/themed";
export var icons = {
    "arrow-right": ArrowRight,
    "arrow-left": ArrowLeft,
    "back-space": BackSpace,
    "bank": Bank,
    "bitcoin": Bitcoin,
    "book": Book,
    "btc-book": BtcBook,
    "caret-down": CaretDown,
    "caret-left": CaretLeft,
    "caret-right": CaretRight,
    "caret-up": CaretUp,
    "check-circle": CheckCircle,
    "check": Check,
    "close": Close,
    "close-cross-with-background": CloseCrossWithBackground,
    "coins": Coins,
    "people": People,
    "copy-paste": CopyPaste,
    "dollar": Dollar,
    "eye-slash": EyeSlash,
    "eye": Eye,
    "filter": Filter,
    "globe": Globe,
    "graph": Graph,
    "image": Image,
    "info": Info,
    "lightning": Lightning,
    "lightning-address": LightningAddress,
    "link": Link,
    "loading": Loading,
    "email-add": EmailAdd,
    "magnifying-glass": MagnifyingGlass,
    "map": Map,
    "menu": Menu,
    "pencil": Pencil,
    "note": Note,
    "rank": Rank,
    "qr-code": QrCode,
    "question": Question,
    "receive": Receive,
    "send": Send,
    "settings": Settings,
    "share": Share,
    "support": Support,
    "transfer": Transfer,
    "user": User,
    "video": Video,
    "warning": Warning,
    "warning-with-background": WarningWithBackground,
    "payment-success": PaymentSuccess,
    "payment-pending": PaymentPending,
    "payment-error": PaymentError,
    "bell": Bell,
    "refresh": Refresh,
    "telegram": Telegram,
    "telegram-simple": TelegramSimple,
    "upgrade": Upgrade,
    "welcome": Welcome,
    "calculator": Calculator,
    "document-outline": DocumentIcon,
    "key-outline": KeyIcon,
    "house-outline": HouseIcon,
    "headset": Headset,
};
export var IconNames = Object.keys(icons);
export var circleDiameterThatContainsSquare = function (squareSize) {
    var SQRT2 = 1.414;
    return Math.round(squareSize * SQRT2);
};
export var GaloyIcon = function (_a) {
    var name = _a.name, size = _a.size, color = _a.color, style = _a.style, backgroundColor = _a.backgroundColor, opacity = _a.opacity;
    var colors = useTheme().theme.colors;
    var styles = useStyles({ backgroundColor: backgroundColor, opacity: opacity, size: size });
    var Icon = icons[name];
    return backgroundColor ? (<View style={[style, styles.iconContainerStyle]}>
      <Icon width={size} opacity={opacity || 1} height={size} color={color || colors.black} fontWeight={"600"} testID={"icon-".concat(name)}/>
    </View>) : (<Icon opacity={opacity || 1} width={size} height={size} color={color || colors.black} style={style} fontWeight={"600"} testID={"icon-".concat(name)}/>);
};
var useStyles = makeStyles(function (_, _a) {
    var backgroundColor = _a.backgroundColor, opacity = _a.opacity, size = _a.size;
    var containerSize = circleDiameterThatContainsSquare(size);
    return {
        iconContainerStyle: {
            opacity: opacity || 1,
            backgroundColor: backgroundColor,
            borderRadius: containerSize,
            width: containerSize,
            height: containerSize,
            alignItems: "center",
            justifyContent: "center",
        },
    };
});
//# sourceMappingURL=galoy-icon.js.map