# Ships the mea_config file the MeaWallet push provisioning SDK reads from the main
# bundle. scripts/install-meawallet-mpp.sh copies it here only on machines that have it,
# and the Podfile includes this pod only then, so the project file never references a
# file most checkouts do not have.
Pod::Spec.new do |s|
  s.name         = "BlinkMeaConfig"
  s.version      = "1.0.0"
  s.summary      = "MeaWallet push provisioning configuration for Blink"
  s.homepage     = "https://github.com/blinkbitcoin/blink-mobile"
  s.license      = { :type => "MIT" }
  s.authors      = { "Blink" => "dev@blink.sv" }
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }
  s.resources    = ["mea_config"]
end
