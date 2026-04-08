const path = require('path');
const fs = require('fs');

// Resolve the storage data directory. When CLAWMANDER_DATA_DIR is set
// (typically by the bin/clawmander.js CLI for npm-installed deployments),
// data lives in the user's home so it survives package upgrades. Otherwise
// fall back to the in-tree backend/storage/data directory used during dev.
function getDataDir() {
  const override = process.env.CLAWMANDER_DATA_DIR;
  const dir = override && override.trim()
    ? override
    : path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function dataPath(...segments) {
  return path.join(getDataDir(), ...segments);
}

module.exports = { getDataDir, dataPath };
