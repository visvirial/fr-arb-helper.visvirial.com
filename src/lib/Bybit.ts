
import {
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';

export type BybitCategory = 'spot' | 'linear' | 'inverse' | 'option';

export class Bybit extends EventTarget implements IExchange {
	
	public readonly name: string = 'Bybit';
	
	//private _wsSpot = new WebSocket(this.wsSpotEndpoint);
	private _wsLinear = new WebSocket(this.wsLinearEndpoint);
	private _initWsPromises: Promise<void>[];
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _instruments: { [category in BybitCategory]: any[] } = {
		spot: [],
		linear: [],
		inverse: [],
		option: [],
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _tickers: { [symbol: string]: any } = {};
	
	constructor(
		public readonly restEndpoint: string = 'https://api.bybit.com',
		//public readonly wsSpotEndpoint: string = 'wss://stream.bybit.com/v5/public/spot',
		public readonly wsLinearEndpoint: string = 'wss://stream.bybit.com/v5/public/linear',
	) {
		super();
		this._initWsPromises = [
			new Promise<void>((resolve, reject) => {
				this._wsLinear.onopen = () => resolve();
				this._wsLinear.onerror = () => reject();
			}),
		];
	}
	
	public async init() {
		// Fetch the instruments.
		for(const category of ['spot', 'linear', 'inverse', 'option']) {
			let nextPageCursor: string = '';
			for(;;) {
				const query: {
					category: string;
					limit: number;
					cursor?: string;
				} = {
					category,
					limit: 1000,
				};
				if(nextPageCursor) {
					query['cursor'] = nextPageCursor;
				}
				const result = await this.fetch('/v5/market/instruments-info', query);
				this._instruments[category as BybitCategory].push(...result.list);
				if(result.nextPageCursor) {
					nextPageCursor = result.nextPageCursor;
				} else {
					break;
				}
			}
		}
		//console.log(this._instruments);
		// Wait for the WebSocket to open.
		await Promise.all(this._initWsPromises);
		this._wsLinear.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if(data.op === 'subscribe') {
				if(!data.success) {
					throw new Error(data.ret_msg);
				}
				return;
			}
			//console.log(data);
			const [topic, symbol] = data.topic.split('.');
			switch(topic) {
				case 'tickers':
					if(data.type === 'snapshot') {
						this._tickers[symbol] = data.data;
						this.dispatchEvent(new Event('tickers'));
					} else if(data.type === 'delta') {
						this._tickers[symbol] = {
							...this._tickers[symbol],
							...data.data,
						};
						this.dispatchEvent(new Event('tickers'));
					}
					break;
			}
		};
		this.subscribe(this._instruments.linear.filter((inst) => inst.symbol.endsWith('USDT')).map((inst) => `tickers.${inst.symbol}`));
	}
	
	public destroy() {
		this._wsLinear.close();
	}
	
	public get instruments() {
		return this._instruments;
	}
	
	public get tickers() {
		return this._tickers;
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetch(path: string, query: any) {
		const queryStr = new URLSearchParams(query).toString();
		const url = `${this.restEndpoint}${path}` + (queryStr ? `?${queryStr}` : '');
		const result = await (await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		})).json();
		if(result.retCode !== 0) {
			throw new Error(result.retMsg);
		}
		return result.result;
	}
	
	public ping() {
		this._wsLinear.send(JSON.stringify({
			op: 'ping',
		}));
	}
	
	public subscribe(args: string[]) {
		this._wsLinear.send(JSON.stringify({
			op: 'subscribe',
			args,
		}));
	}
	
	public unsubscribe(args: string[]) {
		this._wsLinear.send(JSON.stringify({
			op: 'unsubscribe',
			args,
		}));
	}
	
	public isSpotAvailable(symbol: string): boolean {
		return this._instruments.spot.some((inst) => inst.symbol === `${symbol}USDT`);
	}
	
	public isMarginAvailable(symbol: string): boolean {
		return this._instruments.spot.some((inst) => inst.symbol === `${symbol}USDT` && inst.marginTrading !== 'none');
	}
	
	public get tableData(): TableData[] {
		const tableData: TableData[] = [];
		for(const symbol in this.tickers) {
			const ticker = this.tickers[symbol];
			const instrument = this.instruments.linear.find((inst) => inst.symbol === symbol);
			tableData.push({
				exchange: this.name,
				symbol: symbol.replace('USDT', ''),
				fr: +ticker.fundingRate / instrument.fundingInterval * 60 * 24 * 365 * 100,
				markPrice: +ticker.markPrice,
				indexPrice: +ticker.indexPrice,
			});
		}
		return tableData;
	}
	
}

