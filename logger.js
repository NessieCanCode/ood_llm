const fs = require('fs');
const path = require('path');

const logFile = process.env.LOG_FILE
  ? path.resolve(process.env.LOG_FILE)
  : path.join(__dirname, 'app.log');
fs.mkdirSync(path.dirname(logFile), { recursive: true });

function log(message) {
  const ts = new Date().toISOString();
  fs.appendFile(logFile, `[${ts}] ${message}\n`, err => {
    if (err) console.error('log write failed:', err);
  });
}

module.exports = log;

