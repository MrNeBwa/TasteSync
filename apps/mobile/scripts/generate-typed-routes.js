// Regenerates .expo/types/router.d.ts (expo-router typed routes) without
// needing an interactive `expo start` session. Used by `typecheck`/`lint`
// so CI and fresh checkouts get route types matching the current app/ dir.
const path = require('path');
const fs = require('fs');

process.env.EXPO_ROUTER_APP_ROOT = path.join(__dirname, '..', 'app');

const { regenerateDeclarations } = require('../node_modules/expo-router/build/typed-routes/index.js');
const outputDir = path.join(__dirname, '..', '.expo', 'types');
fs.mkdirSync(outputDir, { recursive: true });
regenerateDeclarations(outputDir);
setTimeout(() => process.exit(0), 1500);