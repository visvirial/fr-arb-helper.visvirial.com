
import { serve } from '@hono/node-server'
import { Hono } from 'hono';
import { cors } from 'hono/cors'

import { BitgetCache } from "./BitgetCache";
import { BinanceCache } from './BinanceCache';
import { AsterCache } from './AsterCache';

export const main = async () => {
	const bitgetCache = new BitgetCache();
	const binanceCache = new BinanceCache();
	const asterCache = new AsterCache();
	const startInit = Date.now();
	console.log('Initializing...');
	(async () => {
		await Promise.all([
			bitgetCache.init(),
			binanceCache.init(),
			asterCache.init(),
		]);
		await bitgetCache.run();
		await binanceCache.run();
		await asterCache.run();
	})();
	// Initialize Hono server.
	const app = new Hono();
	app.use('*', cors());
	app.get('/ping', async (c) => {
		return c.json({ pong: Date.now() });
	});
	// Bitget current fund rate.
	app.get('/bitget/current-fund-rate', async (c) => {
		return c.json(bitgetCache.currentFundRates);
	});
	// Binance open interest.
	app.get('/binance/openInterest', async (c) => {
		return c.json(binanceCache.openInterest);
	});
	// Aster funding rate history.
	app.get('/aster/fundingRate', async (c) => {
		return c.json(asterCache.fundingRateHistory);
	});
	// Aster funding rate interval.
	app.get('/aster/fundingRateInterval', async (c) => {
		return c.json(asterCache.fundingRateInterval);
	});
	serve(app);
	console.log('HTTP server started on port 3000.');
};

main();
