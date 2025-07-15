const config = require('./config');
module.exports = {
  basePath: config.baseUri === '/' ? '' : config.baseUri.replace(/\/$/, ''),
  assetPrefix: config.baseUri,
};
