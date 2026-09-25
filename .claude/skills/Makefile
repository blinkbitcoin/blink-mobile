# Discovery and trust for the skills — nothing more.
#
# Doing lives in each skill's SKILL.md: the scripts and their session contract
# are the one interface, for humans and agents alike. Pipeline make-targets
# were tried and deliberately removed — they created a second way to hold
# session state and could not cover the hard middle of the flow (installing a
# build, starting Metro), so they taught a worse path.
#
#   make help   # what's here and where to start
#   make test   # every skill's suite (no simulator, no network)

SKILLS := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

.PHONY: help test

help:
	@echo "Agent skills: tested demo workflows (screenshots/videos onto PRs)."
	@echo "Start at $(SKILLS)/README.md; each skill's SKILL.md is the doing-interface:"
	@for f in "$(SKILLS)"/*/SKILL.md; do echo "  $$(basename "$$(dirname "$$f")")"; done
	@echo
	@echo "  make test   # run every suite (safe anywhere: fake simulators, no network)"

test:
	@"$(SKILLS)/run-all-tests.sh"
