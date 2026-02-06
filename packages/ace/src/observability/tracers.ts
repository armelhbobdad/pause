/**
 * ACE-specific tracing utilities for Opik integration.
 *
 * Provides utilities for conditionally applying Opik tracing to ACE framework components.
 */

// Type variable for decorated functions
type AnyFunction = (...args: any[]) => any;

// Flag to check if Opik is installed (importable)
let _OPIK_INSTALLED = false;
let track: any = null;

try {
  const opikModule = await import("opik");
  track = opikModule.track;
  _OPIK_INSTALLED = true;
} catch {
  // Opik not installed, tracing disabled
  _OPIK_INSTALLED = false;
}

/**
 * Conditionally apply @opik.track decorator if Opik is available and enabled.
 *
 * Respects environment variables:
 * - OPIK_ENABLED=false (or 0/no) - disables tracing
 * - OPIK_DISABLED=true (or 1/yes) - disables tracing
 *
 * @param name - Name for the trace
 * @param tags - Tags for the trace
 * @param options - Additional arguments for @track
 * @returns Decorator function
 */
export function maybeTrack<F extends AnyFunction>(
  name?: string,
  tags?: string[],
  options: Record<string, any> = {}
): (func: F) => F {
  return function decorator(func: F): F {
    // First check: is Opik installed?
    if (!(_OPIK_INSTALLED && track)) {
      return func;
    }

    // Second check: is Opik disabled via environment variable?
    // Import here to avoid circular import at module load time
    const shouldSkip = _shouldSkipOpik();
    if (shouldSkip) {
      return func;
    }

    try {
      // Apply Opik's @track decorator directly
      return track({ name, tags, ...options })(func) as F;
    } catch (e) {
      console.warn(
        `Failed to apply Opik tracking to ${func.name}: ${e instanceof Error ? e.message : String(e)}`
      );
      return func;
    }
  };
}

/**
 * Check if Opik should be disabled via environment variable.
 *
 * Supports both patterns:
 * - OPIK_DISABLED=true/1/yes (disable pattern)
 * - OPIK_ENABLED=false/0/no (enable pattern)
 */
function _shouldSkipOpik(): boolean {
  // Check disable pattern: OPIK_DISABLED=true/1/yes
  const disabled = process.env.OPIK_DISABLED?.toLowerCase();
  if (disabled === "true" || disabled === "1" || disabled === "yes") {
    return true;
  }

  // Check enable pattern: OPIK_ENABLED=false/0/no
  const enabled = process.env.OPIK_ENABLED?.toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "no") {
    return true;
  }

  return false;
}

/**
 * Legacy alias - use maybeTrack instead.
 */
export function trackRole<F extends AnyFunction>(
  name?: string,
  tags?: string[],
  options: Record<string, any> = {}
): (func: F) => F {
  return maybeTrack<F>(name, tags, options);
}

/**
 * Legacy alias - use maybeTrack instead.
 */
export function aceTrack<F extends AnyFunction>(
  name?: string,
  tags?: string[],
  options: Record<string, any> = {}
): (func: F) => F {
  return maybeTrack<F>(name, tags, options);
}
