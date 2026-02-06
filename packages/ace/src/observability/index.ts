/**
 * ACE Observability Module
 *
 * Provides production-grade observability for ACE framework using Opik.
 * Replaces custom explainability implementation with industry-standard tracing.
 */

export {
  configureOpik,
  getIntegration,
  OPIK_AVAILABLE,
  OpikIntegration,
} from "./opik_integration.js";

export { aceTrack, maybeTrack, trackRole } from "./tracers.js";
