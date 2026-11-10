// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path")

/** The MeaWallet push provisioning SDK is vendored by scripts/install-meawallet-mpp.sh
 *  only where the machine can reach MeaWallet's registry, so it is linked only when it
 *  is there. */
const meawalletMppRoot = path.join(__dirname, "vendor/meawallet/react-native-mpp")
const hasMeawalletMpp = fs.existsSync(path.join(meawalletMppRoot, "package.json"))

module.exports = {
  assets: ["./app/assets/fonts/"],
  dependencies: hasMeawalletMpp
    ? { "@meawallet/react-native-mpp": { root: meawalletMppRoot } }
    : {},
}
