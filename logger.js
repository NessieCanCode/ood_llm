const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'app.log');

function log(message) {
  const ts = new Date().toISOString();
  fs.appendFile(logFile, `[${ts}] ${message}\n`, err => {
    if (err) console.error('log write failed:', err);
  });
}

module.exports = log;
