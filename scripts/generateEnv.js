const fs = require('fs');
const path = require('path');

const examplePath = path.join(__dirname, '..', '.env.example');
const localPath = path.join(__dirname, '..', '.env.local');

// Load example file
const example = fs.readFileSync(examplePath, 'utf8');
const lines = example.split(/\r?\n/);

const processed = lines.map(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) return line;
  const key = match[1].trim();
  const defaultValue = match[2];
  let envValue = process.env[key];
  if (envValue === undefined && key === 'NEXT_PUBLIC_BASE_URI') {
    envValue = process.env.PASSENGER_BASE_URI;
  }
  return `${key}=${envValue !== undefined ? envValue : defaultValue}`;
}).join('\n');

fs.writeFileSync(localPath, processed);
console.log(`Generated ${localPath}`);
