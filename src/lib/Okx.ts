
import {
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';

export class Okx extends EventTarget implements IExchange {
	
	private _ws = new WebSocket(this.wsEndpoint);
	private _initWsPromise: Promise<void>;
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _instruments: any[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _frs: { [instId: string]: any } = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _markPrices: { [instId: string]: any } = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _indexPrices: { [instId: string]: any } = {};
	
	constructor(
		public readonly restEndpoint: string = 'https://www.okx.com',
		public readonly wsEndpoint: string = 'wss://ws.okx.com:8443/ws/v5/public',
	) {
		super();
		this._initWsPromise = new Promise<void>((resolve, reject) => {
			this._ws.onopen = () => resolve();
			this._ws.onerror = () => reject();
		});
	}
	
	public async init() {
		// Fetch the instruments.
		this._instruments = await this.fetch('/api/v5/public/instruments', {
			instType: 'SWAP',
		});
		// Fetch the mark prices.
		const markPrices = await this.fetch('/api/v5/public/mark-price', {
			instType: 'SWAP',
		});
		for(const markPrice of markPrices) {
			this._markPrices[markPrice.instId] = markPrice;
		}
		// Fetch the index prices.
		const indexPrices = await this.fetch('/api/v5/market/index-tickers', {
			quoteCcy: 'USDT',
		});
		for(const indexPrice of indexPrices) {
			this._indexPrices[indexPrice.instId] = indexPrice;
		}
		// Wait for the WebSocket to open.
		await this._initWsPromise;
		this._ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if(data.event === 'subscribe') {
				return;
			}
			//console.log(data);
			switch(data.arg.channel) {
				case 'instruments':
					this._instruments = data.data;
					break;
				case 'funding-rate':
					this._frs[data.arg.instId] = data.data[0];
					this.dispatchEvent(new Event('funding-rate'));
					break;
				case 'mark-price':
					this._markPrices[data.arg.instId] = data.data[0];
					this.dispatchEvent(new Event('mark-price'));
					break;
				case 'index-tickers':
					this._indexPrices[data.arg.instId] = data.data[0];
					this.dispatchEvent(new Event('index-price'));
					break;
			}
		};
		// Subscribe to the instruments.
		this.subscribe([
			{
				channel: 'instruments',
				instType: 'SWAP',
			},
		]);
		// Get the USDT-SWAP instrument IDs.
		const instIds = this._instruments.map((inst) => inst.instId).filter((instId) => instId.endsWith('-USDT-SWAP'));
		// Subscribe to the funding rates.
		this.subscribe(
			instIds.map((instId) => ({
				channel: 'funding-rate',
				instId,
			})),
		);
		// Subscribe to the mark price.
		this.subscribe(
			instIds.map((instId) => ({
				channel: 'mark-price',
				instId,
			})),
		);
		// Subscribe to the index price.
		this.subscribe(
			instIds.map((instId) => ({
				channel: 'index-tickers',
				instId: instId.replace('-SWAP', ''),
			})),
		);
	}
	
	public destroy() {
		this._ws.close();
	}
	
	public get instruments() {
		return this._instruments;
	}
	
	public get frs() {
		return this._frs;
	}
	
	public get markPrices() {
		return this._markPrices;
	}
	
	public get indexPrices() {
		return this._indexPrices;
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
		if(result.code !== '0') {
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
	
	public get tableData(): TableData[] {
		const tableData: TableData[] = [];
		for(const instId in this.frs) {
			tableData.push({
				exchange: 'OKX',
				symbol: instId.split('-')[0],
				fr: +this.frs[instId].fundingRate * 3 * 365 * 100,
				markPrice: +this.markPrices[instId].markPx,
				indexPrice: +this.indexPrices[instId.replace('-SWAP', '')].idxPx,
			});
		}
		return tableData;
	}
	
}

