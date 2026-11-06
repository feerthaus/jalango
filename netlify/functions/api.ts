/**
 * Netlify Function wrapping the JalanGo Express API, so the web app and the
 * API deploy together on one domain. Requests to /api/* are routed here by
 * netlify.toml; secrets come from Netlify environment variables.
 */
import express from 'express';
import serverless from 'serverless-http';
import { createApp } from '../../server/src/app';

const outer = express();
// Netlify may hand us the function path; map it back to the /api routes
outer.use((req, _res, next) => {
  req.url = req.url.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
  next();
});
outer.use(createApp());

export const handler = serverless(outer);
