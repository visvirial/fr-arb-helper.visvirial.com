
import { serve } from '@hono/node-server'
import { Hono } from 'hono';

import { BitgetCache } from "./BitgetCache";

export const main = async () => {
	const bitgetCache = new BitgetCache();
	const startInit = Date.now();
	console.log('Initializing BitgetCache...');
	await bitgetCache.init();
	await bitgetCache.run();
	// Initialize Hono server.
	const app = new Hono();
	app.get('/ping', async (c) => {
		return c.json({ pong: Date.now() });
	});
	app.get('/current-fund-rate', async (c) => {
		return c.json(bitgetCache.currentFundRates);
	});
	serve(app);
	console.log('HTTP server started on port 3000.');
};

main();
