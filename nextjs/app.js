const express = require('express');
const next    = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const baseUri = process.env.PASSENGER_BASE_URI || '/';

app.prepare().then(() => {
  const server = express();

  // Mount under the base URI
  server.use(baseUri, (req, res) => {
    // Strip off the base path before handing to Next
    req.url = req.url.replace(new RegExp(`^${baseUri}`), '') || '/';
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Next.js app listening on ${baseUri} (port ${port})`);
  });
});
