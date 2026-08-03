// Shared canvas backing-store ceilings for the whole engine.
//
// Safari/iOS refuse backing stores beyond ~16.7M pixels (and 4096px per edge on
// older devices) and hand back a blank canvas instead of throwing. Both the
// decode-time guard (processor.js) and the resize-target guard (resizer.js)
// clamp against these, so they must agree — hence a single source of truth.
export const MAX_EDGE = 4096;
export const MAX_PIXELS = 16777216;
