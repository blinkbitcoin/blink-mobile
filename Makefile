check-code:
	yarn check-code

unit:
	yarn test

test: unit check-code

codegen:
	./supergraph.sh
	yarn dev:codegen
	yarn update-translations

reset-ios:
	yarn cache:clear
	yarn install
	yarn ios

start:
	yarn start

tilt-up:
	cd dev && tilt up

tilt-down:
	cd dev && tilt down

emulator:
	emulator -avd Pixel_API_34 -gpu swiftshader -wipe-data -no-boot-anim

reset-e2e:
	tilt trigger dev-setup
	tilt wait --timeout 5m --for=condition=Ready uiresources dev-setup

e2e-ios: reset-e2e
	yarn e2e:build ios.sim.debug
	yarn e2e:test ios.sim.debug

e2e-android: reset-e2e
	yarn e2e:build android.emu.debug
	yarn e2e:test android.emu.debug

make audit:
	./audit.sh
