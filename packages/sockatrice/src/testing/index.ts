// Public testing surface for consumers of @cockatrice/sockatrice.
// Re-exports proto message builders and mock-WebSocket helpers used to drive
// the WebClient/Protobuf service stack from a test harness.
// NOT for redux state-shape fixtures — those live in @cockatrice/datatrice/testing.
//
// Importing this barrel is side-effect-free. Consumers who want the
// vitest beforeEach/afterEach lifecycle plus the global-WebSocket installation
// must import the dedicated `@cockatrice/sockatrice/testing/setup-hooks`
// subpath (typically from a vitest `setupFiles` entry).
export * from './protobuf-builders';
export * from './setup';
export * from './command-capture';
export * from './web-client-stubs';
export * from './mock-websocket';
export * from './callback-helpers';
