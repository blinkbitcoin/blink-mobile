import * as React from "react";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { ExpirationTimeButton } from "./expiration-time-button";
import { ExpirationTimeModal } from "./expiration-time-modal";
export var ExpirationTimeChooser = function (_a) {
    var expirationTime = _a.expirationTime, setExpirationTime = _a.setExpirationTime, walletCurrency = _a.walletCurrency, disabled = _a.disabled, big = _a.big, style = _a.style;
    var _b = React.useState(false), openModal = _b[0], setOpenModal = _b[1];
    var LL = useI18nContext().LL;
    var onSetExpirationTime = function (expirationTime) {
        setExpirationTime && setExpirationTime(expirationTime);
        setOpenModal(false);
    };
    if (openModal) {
        return (<ExpirationTimeModal value={expirationTime} isOpen={true} onSetExpirationTime={onSetExpirationTime} close={function () { return setOpenModal(false); }} walletCurrency={walletCurrency}/>);
    }
    var getExpirationTimeFormat = function (timeIn) {
        var _a;
        var minutes = (_a = timeIn.minutes) !== null && _a !== void 0 ? _a : 0;
        if (minutes === 0)
            return null;
        var unidades = [
            { umbral: 1440, singular: LL.common.day.one(), plural: LL.common.day.other() },
            { umbral: 60, singular: LL.common.hour(), plural: LL.common.hours() },
            { umbral: 1, singular: LL.common.minute(), plural: LL.common.minutes() },
        ];
        for (var _i = 0, unidades_1 = unidades; _i < unidades_1.length; _i++) {
            var unidad = unidades_1[_i];
            if (minutes >= unidad.umbral) {
                var cantidad = Math.floor(minutes / unidad.umbral);
                return "".concat(cantidad, " ").concat(cantidad === 1 ? unidad.singular : unidad.plural);
            }
        }
        return "".concat(minutes, " ").concat(LL.common.minutes());
    };
    var onPressInputButton = function () {
        if (disabled)
            return;
        setOpenModal(true);
    };
    return (<ExpirationTimeButton placeholder={LL.common.expirationTime()} onPress={onPressInputButton} value={getExpirationTimeFormat({ minutes: expirationTime })} disabled={disabled} iconName="pencil" primaryTextTestProps={"Expiration time input button"} big={big} style={style} {...testProps("Expiration time button")}/>);
};
//# sourceMappingURL=expiration-time-input.js.map