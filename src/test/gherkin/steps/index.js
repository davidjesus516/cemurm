/**
 * StepRegistry — singleton managing step definitions per module.
 * Key: moduleName (string), Value: { given: [], when: [], then: [] }
 * Each entry: { pattern: RegExp, handler: (context, ...args) => Promise<void> | void }
 */
class StepRegistry {
  constructor() {
    this.registry = new Map()
  }

  /**
   * Register step patterns for a module.
   * @param {string} moduleName - e.g., 'search', 'integrations'
   * @param {Array<{type: 'given'|'when'|'then', pattern: RegExp, handler: Function}>} patterns
   */
  defineSteps(moduleName, patterns) {
    if (!this.registry.has(moduleName)) {
      this.registry.set(moduleName, { given: [], when: [], then: [] })
    }
    const moduleSteps = this.registry.get(moduleName)
    for (const { type, pattern, handler } of patterns) {
      if (!['given', 'when', 'then'].includes(type)) {
        throw new Error(`Invalid step type: ${type}. Must be 'given', 'when', or 'then'`)
      }
      moduleSteps[type].push({ pattern, handler })
    }
  }

  /**
   * Get registered patterns for a module.
   * @param {string} moduleName
   * @returns {{given: [], when: [], then: []}}
   */
  getSteps(moduleName) {
    return this.registry.get(moduleName) || { given: [], when: [], then: [] }
  }

  /**
   * Find a matching handler for a step string.
   * @param {string} moduleName
   * @param {string} stepString
   * @returns {{handler: Function, args: object} | null}
   */
  findHandler(moduleName, stepString) {
    const steps = this.getSteps(moduleName)
    const allSteps = [...steps.given, ...steps.when, ...steps.then]
    for (const { pattern, handler } of allSteps) {
      const match = stepString.match(pattern)
      if (match) {
        return { handler, args: match.groups || {} }
      }
    }
    return null
  }

  /**
   * Execute a scenario's steps in order.
   * @param {string} moduleName
   * @param {string[]} scenarioSteps - e.g., ['Given I have songs...', 'When I search...', 'Then I see...']
   * @param {object} [context={}] - initial context, passed through all handlers
   * @returns {Promise<object>} final context
   */
  async runScenario(moduleName, scenarioSteps, context = {}) {
    for (const stepString of scenarioSteps) {
      const trimmed = stepString.trim()
      if (!trimmed) continue

      // Strip Gherkin keywords (Given/When/Then/And) from step text
      let stepText = trimmed
      stepText = stepText.replace(/^(Given|When|Then|And)\s+/i, '')

      const match = this.findHandler(moduleName, stepText)
      if (!match) {
        throw new Error(`No step definition matches: "${stepString}" in module "${moduleName}"`)
      }

      const { handler, args } = match
      await handler(context, args)
    }
    return context
  }
}

// Singleton export
export const registry = new StepRegistry()

/** Convenience: defineSteps('module', [...]) → registry.defineSteps(...) */
export function defineSteps(moduleName, patterns) {
  return registry.defineSteps(moduleName, patterns)
}

/** Convenience: get steps for a module */
export function getSteps(moduleName) {
  return registry.getSteps(moduleName)
}

/**
 * Create a runner bound to a module with domain functions pre-loaded.
 * @param {object} domainFunctions - key-value map of domain functions to inject into context
 * @returns {{registry: StepRegistry, runScenario: Function}}
 */
export function createRunner(domainFunctions = {}) {
  return {
    registry,
    runScenario: async (moduleName, scenarioSteps, initialContext = {}) => {
      const context = { ...domainFunctions, ...initialContext }
      return registry.runScenario(moduleName, scenarioSteps, context)
    }
  }
}