const config = require('./config');
const prefix = config.baseUri.replace(/\/$/, '');

module.exports = {
  basePath: prefix === '/' ? '' : prefix,
  assetPrefix: prefix === '/' ? '' : prefix,
};
