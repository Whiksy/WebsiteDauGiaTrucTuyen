const Logger = require('./Logger');

/**
 * Singleton instance of Logger
 */
const instances = {}; // Use an object as a registry

/**
 * Get or create singleton Logger instance
 */
function getLogger(context = 'App') {
  if (!instances[context]) {
    instances[context] = new Logger(context);
  }
  return instances[context];
}

module.exports = { Logger, getLogger };
