
import {
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';

export class Bitget extends EventTarget implements IExchange {
	
	public readonly name: string = 'Bitget';
	
	private _ws = new WebSocket(this.wsEndpoint);
	private _initWsPromise: Promise<void>;
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _currentFundRate: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _spotSymbols: any[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _marginCurrencies: any[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _tickers: any[] = [];
	
	constructor(
		public readonly restEndpoint: string = 'https://api.bitget.com',
		public readonly wsEndpoint: string = 'wss://ws.bitget.com/v2/ws/public',
	) {
		super();
		this._initWsPromise = new Promise<void>((resolve, reject) => {
			this._ws.onopen = () => resolve();
			this._ws.onerror = () => reject();
		});
		this._ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if(data.action === 'snapshot' && data.arg && data.arg.instType === 'USDT-FUTURES' && data.arg.channel === 'ticker') {
				const tickerIndex = this._tickers.findIndex((ticker) => ticker.symbol === data.arg.instId);
				if(tickerIndex === -1) {
					throw new Error(`Ticker ${data.arg.instId} not found`);
				}
				this._tickers[tickerIndex] = data.data[0];
				this.dispatchEvent(new Event('ticker'));
			}
		};
	}
	
	public async init() {
		// Get the current funding rate.
		this._currentFundRate = await (await fetch('https://fr-arb-helper-bitget-cache.visvirial.com/current-fund-rate')).json();
		// Get spot symbols.
		this._spotSymbols = await this.fetch('/api/v2/spot/public/symbols');
		// Get margin currencies.
		this._marginCurrencies = await this.fetch('/api/v2/margin/currencies');
		// Get futures tickers.
		this._tickers = await this.fetch('/api/v2/mix/market/tickers', {
			productType: 'USDT-FUTURES',
		});
		// Wait for the WebSocket to be ready.
		await this._initWsPromise;
		// Subscribe to the futures tickers.
		this.subscribe(this._tickers.filter((ticker) => ticker.symbol.endsWith('USDT')).map((ticker) => ({
			instType: 'USDT-FUTURES',
			channel: 'ticker',
			instId: ticker.symbol,
		})));
	}
	
	public destroy() {
		this._ws.close();
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetch(path: string, query?: any) {
		const queryStr = new URLSearchParams(query).toString();
		const url = `${this.restEndpoint}${path}` + (queryStr ? `?${queryStr}` : '');
		const result = await (await fetch(url, {
			method: 'GET',
			headers: {
				//'Content-Type': 'application/json',
			},
		})).json();
		if(result.code !== '00000') {
			throw new Error(result.msg);
		}
		return result.data;
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public subscribe(args: any[]) {
		this._ws.send(JSON.stringify({
			op: 'subscribe',
			args,
		}));
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public unsubscribe(args: any[]) {
		this._ws.send(JSON.stringify({
			op: 'unsubscribe',
			args,
		}));
	}
	
	public isSpotAvailable(symbol: string): boolean {
		return this._spotSymbols.some((spotSymbol) => spotSymbol.symbol === `${symbol}USDT`);
	}
	
	public isMarginAvailable(symbol: string): boolean {
		return this._marginCurrencies.some((currency) => currency.symbol === `${symbol}USDT`);
	}
	
	public get tableData(): TableData[] {
		const tableData: TableData[] = [];
		for(const ticker of this._tickers) {
			if(!ticker.symbol.endsWith('USDT')) {
				continue;
			}
			const currentFundRate = this._currentFundRate[ticker.symbol];
			if(!currentFundRate) {
				continue;
				//throw new Error(`Current funding rate not found for ${ticker.symbol}`);
			}
			tableData.push({
				exchange: this.name,
				symbol: ticker.symbol.slice(0, -4),
				fr: +ticker.fundingRate / currentFundRate.fundingRateInterval * 24 * 365 * 100,
				markPrice: +ticker.markPrice,
				indexPrice: +ticker.indexPrice,
				oi: +ticker.holdingAmount * +ticker.markPrice,
			});
		}
		return tableData;
	}
	
}
