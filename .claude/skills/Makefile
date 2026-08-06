# Shortcuts for the demo pipeline — thin delegations to the tested scripts.
#
# Session env (udid/port) is derived from the session registry, so after
# `make claim PR=<n>` every other target needs only the same PR=<n>. The app
# id still comes from the environment (DEMO_APP_ID_IOS / DEMO_APP_ID_ANDROID);
# a repo adopting the skills documents its values in its agent instructions.
#
#   make help                              # this list
#   make claim PR=1234                     # isolated simulator + Metro port
#   make shot PR=1234 LABEL=after          # settle-aware screenshot -> ./shots
#   make record PR=1234 FLOW=flow.yaml     # maestro-driven video -> ./demo
#   make publish PR=1234 FILES="shots/after.png"   # embed on the PR
#   make reset PR=1234                     # true fresh-install simulation
#   make release PR=1234 [DELETE=1]        # release + collateral check
#   make test                              # every skill's suite

SKILLS := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
REG    ?= $(if $(DEMO_SIM_REGISTRY),$(DEMO_SIM_REGISTRY),$(HOME)/.claude/rn-sim-sessions)
OUT    ?= ./shots
DEMO_OUT ?= ./demo
LABEL  ?= after
PURPOSE ?= screenshots

need-pr = $(if $(PR),,$(error PR=<pr-number> is required))
SESSION = DEMO_UDID="$$(cat '$(REG)/pr$(PR)/udid')" DEMO_PORT="$$(cat '$(REG)/pr$(PR)/port')" DEMO_SESSION_DIR='$(REG)/pr$(PR)'

.PHONY: help claim shot record publish reset release test

help: ## list the targets
	@sed -n 's/^#   make /  make /p' $(lastword $(MAKEFILE_LIST))

claim: ## claim an isolated simulator + Metro port for PR=<n>
	$(call need-pr)
	@"$(SKILLS)/react-native-ios-simulator/scripts/claim-session.sh" $(PR)
	@echo "# tip: eval the exports above, or just keep passing PR=$(PR) to make"

shot: ## settle-aware screenshot: LABEL=<name> [OUT=./shots]
	$(call need-pr)
	@$(SESSION) "$(SKILLS)/react-native-demo-screenshots/scripts/capture.sh" $(LABEL) $(OUT)

record: ## record a maestro FLOW=<file.yaml>: LABEL=<name> [DEMO_OUT=./demo]
	$(call need-pr)
	$(if $(FLOW),,$(error FLOW=<flow.yaml> is required))
	@$(SESSION) "$(SKILLS)/react-native-demo-videos/scripts/record-flow.sh" $(LABEL) $(FLOW) $(DEMO_OUT)

publish: ## push FILES="a.png b.gif" to the PR's assets branch [PURPOSE=screenshots]
	$(call need-pr)
	$(if $(FILES),,$(error FILES="<img> [...]" is required))
	@"$(SKILLS)/github-pr-image-attachments/scripts/push-assets-branch.sh" $(PR) $(PURPOSE) $(FILES)

reset: ## reset the app to a fresh install on the claimed simulator
	$(call need-pr)
	@$(SESSION) "$(SKILLS)/react-native-ios-simulator/scripts/reset-app.sh"

release: ## release the session (DELETE=1 removes the simulator now)
	$(call need-pr)
	@"$(SKILLS)/react-native-ios-simulator/scripts/release-session.sh" $(PR) $(if $(DELETE),--delete)

test: ## run every skill's test suite
	@"$(SKILLS)/run-all-tests.sh"
