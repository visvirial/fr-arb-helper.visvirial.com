
import {
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';

export interface MarkPriceStreamData {
	e: string; // Event type
	E: number; // Event time
	s: string; // Symbol
	p: string; // Mark price
	i: string; // Index price
	P: string; // Estimated settl price
	r: string; // Funding rate
	T: number; // Next funding time
}

export interface FundingRate {
	symbol: string;
	fundingRate: number;
	fundingTime: number;
}

export interface FundingRateInterval {
	symbol: string;
	fundingInterval: number;
}

export class Aster extends EventTarget implements IExchange {
	
	public readonly name: string = 'Aster';
	
	private _wsMarkPrice: WebSocket;
	private _markPrices: Record<string, MarkPriceStreamData> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _exchangeInfo: any = null;
	private _fundingRate: FundingRate[] = [];
	private _fundingRateInterval: FundingRateInterval[] = [];
	
	constructor(
		public readonly restEndpoint: string = 'https://fapi.asterdex.com',
		public readonly wsEndpoint: string = 'wss://fstream.asterdex.com',
	) {
		super();
		this._wsMarkPrice = new WebSocket(this.wsEndpoint + '/ws/!markPrice@arr@1s');
		this._wsMarkPrice.onmessage = (event) => {
			const data = JSON.parse(event.data);
			for(const item of data as MarkPriceStreamData[]) {
				this._markPrices[item.s] = item;
			}
		};
	}
	
	public async init() {
		this._exchangeInfo = await (await fetch(`${this.restEndpoint}/fapi/v1/exchangeInfo`)).json();
		//this._fundingRate = (await (await fetch(`${this.restEndpoint}/fapi/v1/fundingRate?limit=1000`)).json())
		this._fundingRateInterval = await (await fetch('https://fr-arb-helper-backend.visvirial.com/aster/fundingRateInterval')).json();
	}
	
	public destroy() {
	}
	
	public get symbols(): string[] {
		if(this._exchangeInfo === null) {
			return [];
		}
		return this._exchangeInfo.symbols
			.filter((s: {status: string}) => s.status === 'TRADING')
			.map((s: {symbol: string}) => s.symbol);
	}
	
	public getFundingInterval(symbol: string): number {
		const interval = this._fundingRateInterval.find((f) => f.symbol === symbol);
		if(interval === undefined) {
			console.log(symbol, this._fundingRateInterval);
		}
		return interval!.fundingInterval;
	}
	
	public isSpotAvailable(symbol: string): boolean {
		return false;
	}
	
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public isMarginAvailable(symbol: string): boolean {
		return false;
	}
	
	public get tableData(): TableData[] {
		const tableData: TableData[] = [];
		const symbols = this.symbols;
		for(const symbol in this._markPrices) {
			if(!symbols.includes(symbol)) {
				continue;
			}
			const markPriceData = this._markPrices[symbol];
			tableData.push({
				exchange: this.name,
				symbol: symbol.replace('USDT', ''),
				fr: +markPriceData.r / this.getFundingInterval(symbol) * 1000 * 60 * 60 * 24 * 365 * 100,
				markPrice: +markPriceData.p,
				indexPrice: +markPriceData.i,
				oi: 0,
			});
		}
		return tableData;
	}
	
}
