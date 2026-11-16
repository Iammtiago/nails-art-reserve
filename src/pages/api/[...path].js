// Mounts the Express API on /api/* inside Next.js. On Vercel this file becomes a
// single Node.js Vercel Function (configured in vercel.json).

import { createApp } from '../../../server/app.js';

const app = createApp();

export const config = {
  api: {
    bodyParser: false, // Express parses the body itself (express.json, 10 MB limit)
    externalResolver: true, // Express owns the response lifecycle
    responseLimit: false,
  },
};

export default function handler(req, res) {
  return new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    app(req, res);
  });
}
