
import { setTimeout } from 'node:timers/promises';

export class BitgetCache {
	
	private _intervalId: NodeJS.Timeout | null = null;
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _tickers: any[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _currentFundRates: { [symbol: string]: any } = {};
	
	constructor(
		public readonly restEndpoint: string = 'https://api.bitget.com',
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
		this._tickers = await this.fetch('/api/v2/mix/market/tickers', {
			productType: 'USDT-FUTURES',
		});
		//console.log('Tickers:', this._tickers);
		const symbols = this.symbols;
		for(const symbol of symbols) {
			// Fetch the current fund rate.
			const fr = await this.fetch('/api/v2/mix/market/current-fund-rate', {
				symbol,
				productType: 'USDT-FUTURES',
			});
			this._currentFundRates[symbol] = fr[0];
			// Wait.
			await setTimeout(60);
		}
		console.log(`[BitGetCache.refreshCaches()] Refreshed caches in ${(Date.now() - start).toLocaleString()}ms.`);
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetch(path: string, query?: any) {
		const queryStr = new URLSearchParams(query).toString();
		const url = `${this.restEndpoint}${path}` + (queryStr ? `?${queryStr}` : '');
		const response = await fetch(url);
		//console.log('Response:', response.status, response.statusText);
		const result: any = await response.json();
		if(result.code !== '00000') {
			throw new Error(`Failed to fetch ${url}: ` + result.msg);
		}
		return result.data;
	}
	
	public get symbols() {
		return this._tickers.filter((ticker) => ticker.lastPr !== '0').map((ticker) => ticker.symbol);
	}
	
	public get currentFundRates() {
		return this._currentFundRates;
	}
	
	public get fundingRateIntervals() {
		return this.currentFundRates.map((fr: any) => +fr.fundingRateInterval);
	}
	
}
