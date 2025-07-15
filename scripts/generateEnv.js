const fs = require('fs');
const path = require('path');

const examplePath = path.join(__dirname, '..', '.env.example');
const localPath = path.join(__dirname, '..', '.env.local');

// Load example file
const example = fs.readFileSync(examplePath, 'utf8');
const lines = example.split(/\r?\n/);

let baseUri;
const processed = lines.map(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) return line;
  const key = match[1].trim();
  const defaultValue = match[2];
  const envValue = process.env[key];
  const value = envValue !== undefined ? envValue : defaultValue;
  if (key === 'PASSENGER_BASE_URI') baseUri = value;
  return `${key}=${value}`;
}).join('\n');

fs.writeFileSync(localPath, processed);
console.log(`Generated ${localPath}`);

// Save build metadata
const nextDir = path.join(__dirname, '..', '.next');
fs.mkdirSync(nextDir, { recursive: true });
const metaPath = path.join(nextDir, 'build-meta.json');
const buildMeta = { baseUri };
fs.writeFileSync(metaPath, JSON.stringify(buildMeta));
console.log(`Saved ${metaPath}`);
