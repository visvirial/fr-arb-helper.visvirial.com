
import { setTimeout } from 'node:timers/promises';

export interface FundingRate {
	symbol: string;
	fundingRate: number;
	fundingTime: number;
}

export class AsterCache {
	
	private _intervalId: NodeJS.Timeout | null = null;
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _exchangeInfo: any;
	private _fundingRate: Record<string, FundingRate[]> = {};
	
	constructor(
		public readonly restEndpoint: string = 'https://fapi.asterdex.com',
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
	
	public get symbols(): string[] {
		if(this._exchangeInfo === null) {
			return [];
		}
		return this._exchangeInfo.symbols
			.filter((s: {status: string}) => s.status === 'TRADING')
			.map((s: {symbol: string}) => s.symbol);
	}

	public async refreshCaches() {
		const start = Date.now();
		this._exchangeInfo = await (await fetch(`${this.restEndpoint}/fapi/v1/exchangeInfo`)).json();
		const symbols = this.symbols;
		for(const symbol of symbols) {
			this._fundingRate[symbol] = await (await fetch(`${this.restEndpoint}/fapi/v1/fundingRate?symbol=${symbol}&limit=10`)).json();
		}
		console.log(`[AsterCache.refreshCaches()] Refreshed caches in ${(Date.now() - start).toLocaleString()}ms.`);
	}
	
	public get fundingRateHistory() {
		const result = [];
		for(const symbol in this._fundingRate) {
			result.push(...this._fundingRate[symbol]);
		}
		return result;
	}
	
	public get fundingRateInterval() {
		const result = [];
		for(const symbol in this._fundingRate) {
			const fr = this._fundingRate[symbol];
			fr.sort((a, b) => b.fundingTime - a.fundingTime);
			result.push({
				symbol,
				fundingInterval: fr[0].fundingTime - fr[1].fundingTime,
			});
		}
		return result;
	}
	
}
