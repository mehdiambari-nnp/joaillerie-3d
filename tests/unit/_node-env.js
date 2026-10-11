// Stubs DOM minimaux pour exécuter les loaders three.js sous Node (tests).
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
globalThis.document ??= { createElementNS: () => ({ style: {}, addEventListener() {} }), createElement: () => ({ style: {}, addEventListener() {} }) };
