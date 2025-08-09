
import { setTimeout } from 'node:timers/promises';

export class BinanceCache {
	
	private _intervalId: NodeJS.Timeout | null = null;
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _tickers: any[] = [];
	private _ois: { [symbol: string]: number } = {};
	
	constructor(
		public readonly spotRestEndpoint: string = 'https://api.binance.com',
		public readonly derivativesRestEndpoint: string = 'https://fapi.binance.com',
		public readonly derivativesWsEndpoint: string = 'wss://fstream.binance.com/ws',
	) {
	}
	
	public async init() {
		await this.refreshCaches();
	}
	
	public async run() {
		this._intervalId = setInterval(this.refreshCaches.bind(this), 10 * 60 * 1000);
	}
	
	public async destroy() {
		if(this._intervalId !== null) {
			clearInterval(this._intervalId);
		}
	}
	
	public async refreshCaches() {
		const start = Date.now();
		this._tickers = await this.fetch('derivatives', '/fapi/v2/ticker/price');
		const symbols = this.symbols;
		for(const symbol of symbols) {
			// Fetch the current open interest.
			try {
				const oi = await this.fetch('derivatives', '/fapi/v1/openInterest', { symbol });
				this._ois[symbol] = +oi.openInterest;
			} catch(e) {
				console.log(`[BinanceCache.refreshCaches()] Failed to fetch current open interest for ${symbol}:`, e);
			}
			// Wait.
			await setTimeout(30);
		}
		console.log(`[BinanceCache.refreshCaches()] Refreshed caches in ${(Date.now() - start).toLocaleString()}ms.`);
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetch(type: 'spot' | 'derivatives', path: string, query?: any) {
		const queryStr = new URLSearchParams(query).toString();
		const endpoint = {
			spot: this.spotRestEndpoint,
			derivatives: this.derivativesRestEndpoint,
		}[type];
		const url = `${endpoint}${path}` + (queryStr ? `?${queryStr}` : '');
		const response = await fetch(url);
		//console.log('Response:', response.status, response.statusText);
		const result: any = await response.json();
		return result;
	}
	
	public get symbols() {
		return this._tickers
			.map((ticker) => ticker.symbol);
	}
	
	public get openInterest() {
		return this._ois;
	}
	
}
