import app from '../server/app.js';

const HANDLER_VERSION = 'api-index-v2';

export default function handler(req, res) {
  res.setHeader('x-microjobs-handler', HANDLER_VERSION);
  return app(req, res);
}
