# AI Agent Development Rules for Blink Mobile

## Purpose

Defines how AI coding assistants (GitHub Copilot, Claude, ChatGPT, etc.) may assist with **React Native + TypeScript** development while establishing clear boundaries around code review and approval authority.

**Core Principles**: AI agents assist but don't decide. All PRs require human review and approval. Code ownership remains with humans.

---

## Allowed AI Activities

### React Native + TypeScript Development
- Generate components, hooks, utilities with TypeScript annotations
- Implement platform-specific code (iOS/Android), navigation, state management, styling
- Write and refactor code following project patterns
- Use latest stable TypeScript with modern features (satisfies, template literals, const assertions, utility types)
- Apply strict typing: no `any` without justification, proper null handling, type guards

### Testing
- Write Jest unit tests, React Testing Library component tests, Detox E2E tests
- **Test Coverage**: Every module (e.g., `useSomeHook.tsx`) must have a corresponding test file (e.g., `useSomeHook.spec.tsx`)
- Cover edge cases with AAA pattern (Arrange, Act, Assert)
- Create mocks, fixtures, and test IDs
- **Mocking Best Practices**: Avoid "mocking bugs away" - ensure mocked behaviors accurately reflect real implementations and don't hide potential issues

### Code Quality
- Refactor for clarity and performance
- **Extract Reusable Utilities**: Identify repeated or universal logic and extract it into reusable utilities - avoid filling screen components with common/generic logic
- Add documentation (JSDoc, inline comments)
- **Keep Documentation in Sync**: Ensure all docs and comments are updated when implementation changes - out-of-sync documentation is misleading
- Implement error handling, accessibility features, performance optimizations
- Apply ESLint/Prettier fixes
- Identify bugs, anti-patterns, and security vulnerabilities
- **Dependency Management**: Flag outdated dependencies and warn when packages need updates for security or compatibility

---

## Tool Requirements

AI-generated code **MUST**:
- Pass ESLint rules and Prettier formatting
- Compile without TypeScript errors (strict mode, recent stable version)
- Pass all tests (Jest, Detox)
- Work with React Native CLI and Metro bundler

---

## Prohibited AI Activities

AI agents **MUST NOT**:
- ❌ Approve PRs or act as sole reviewer
- ❌ Make architectural decisions or choose dependencies without approval
- ❌ Modify CI/CD, build configs, or environment settings unilaterally
- ❌ Disable security checks or commit secrets
- ❌ Deploy to production or change version numbers without oversight

---

## Human Responsibilities

**Code Review**: All PRs require ≥1 human reviewer verifying correctness, type safety, best practices, tests, security, and performance.

**Quality Assurance**: Test on real devices/simulators (iOS & Android), run full test suite, check for errors.

**Decisions**: Humans decide architecture, design patterns, dependencies, and CI fixes.

---

## Best Practices

### Using AI Effectively
1. Be specific with context and requirements
2. Request incremental changes, not large rewrites
3. Review AI code line-by-line
4. Test thoroughly after AI changes

### Quality Checklist
- ✅ Strict TypeScript types
- ✅ Follows project patterns
- ✅ ESLint/Prettier pass
- ✅ Tests added/updated (matching file exists for each module)
- ✅ Mocks accurately reflect real behavior
- ✅ Documentation in sync with implementation
- ✅ Dependencies are up to date
- ✅ Reusable logic extracted into utilities (not duplicated in components)
- ✅ Works on iOS & Android
- ✅ No security vulnerabilities

### Version Control
- Humans approve commit messages (follow conventional commits if applicable)
- Review all changes before committing
- Keep commits atomic and meaningful

### When to Avoid AI
- Critical security code (auth, encryption, payments)
- Complex business logic requiring domain expertise
- Regulatory compliance code (PCI, GDPR, etc.)
- Legacy code with intricate dependencies

---

## Summary

AI assistants accelerate React Native + TypeScript development through code generation, testing, and analysis. **Humans retain responsibility** for review, architecture, security, and deployment.

**Remember**: AI is your copilot, not your pilot. 🚀

---

*Version 1.0.0 • Update as AI capabilities evolve*
