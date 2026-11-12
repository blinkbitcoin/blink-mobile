// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path")

/** Where scripts/install-meawallet-mpp.sh vendors the MeaWallet push provisioning SDK, on
 *  machines that can reach MeaWallet's registry. The script leaves a copy there only once
 *  it is verified, so the Metro and React Native configs link it whenever it is there, and
 *  read both from here so they never disagree. */
const root = path.resolve(__dirname, "../vendor/meawallet/react-native-mpp")

const isInstalled = () => fs.existsSync(path.join(root, "package.json"))

module.exports = { root, isInstalled }
