
import {
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';

export interface BinanceFundingInfo {
	symbol: string;
	adjustedFundingRateCap: string;
	adjustedFundingRateFloor: string;
	fundingIntervalHours: number;
	disclaimer: boolean;
}

export interface BinanceMarkPriceStream {
	e: string; // Event type.
	E: number; // Event time.
	s: string; // Symbol.
	p: string; // Mark price.
	i: string; // Index price.
	P: string; // Estimated Settle Price.
	r: string; // Funding rate.
	T: number; // Next funding time.
}

export class Binance extends EventTarget implements IExchange {
	
	public readonly name: string = 'Binance';
	
	private _derivativesWs = new WebSocket(this.derivativesWsEndpoint);
	private _initDerivativesWsPromise: Promise<void>;
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _spotExchangeInfo: any = null;
	private _fundingInfo: BinanceFundingInfo[] = [];
	private _markPriceStream: BinanceMarkPriceStream[] = [];
	private _openInterest: { [symbol: string]: number } = {};
	
	constructor(
		public readonly spotRestEndpoint: string = 'https://api.binance.com',
		public readonly derivativesRestEndpoint: string = 'https://fapi.binance.com',
		public readonly derivativesWsEndpoint: string = 'wss://fstream.binance.com/ws',
	) {
		super();
		this._initDerivativesWsPromise = new Promise<void>((resolve, reject) => {
			this._derivativesWs.onopen = () => resolve();
			this._derivativesWs.onerror = () => reject();
		});
	}
	
	public async init() {
		// Fetch spot exchange info.
		this._spotExchangeInfo = await (await fetch(this.spotRestEndpoint + '/api/v3/exchangeInfo')).json();
		// Fetch fundingInfo.
		this._fundingInfo = await (await fetch(this.derivativesRestEndpoint + '/fapi/v1/fundingInfo')).json();
		// Fetch open interest.
		this._openInterest = await (await fetch('https://fr-arb-helper-backend.visvirial.com/binance/openInterest')).json();
		// Wait for the WebSocket to open.
		await this._initDerivativesWsPromise;
		this._derivativesWs.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if(data.id !== undefined) return;
			this._markPriceStream = data;
		};
		// Subscribe to the mark price stream.
		this.subscribe(
			['!markPrice@arr']
		);
	}
	
	public destroy() {
		this._derivativesWs.close();
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public subscribe(params: any[]) {
		this._derivativesWs.send(JSON.stringify({
			method: 'SUBSCRIBE',
			params,
		}));
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public unsubscribe(params: any[]) {
		this._derivativesWs.send(JSON.stringify({
			method: 'UNSUBSCRIBE',
			params,
		}));
	}
	
	public isSpotAvailable(symbol: string): boolean {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this._spotExchangeInfo.symbols.some((s: any) => s.symbol === symbol + 'USDT' && s.status === 'TRADING' && s.permissionSets[0].includes('SPOT'));
	}
	
	public isMarginAvailable(symbol: string): boolean {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this._spotExchangeInfo.symbols.some((s: any) => s.symbol === symbol + 'USDT' && s.status === 'TRADING' && s.permissionSets[0].includes('MARGIN'));
	}
	
	public get tableData(): TableData[] {
		const tableData: TableData[] = [];
		for(const markPrice of this._markPriceStream) {
			const fundingInfo = this._fundingInfo.find(info => info.symbol === markPrice.s);
			const fundingIntervalHours = fundingInfo ? fundingInfo.fundingIntervalHours : 8; // Default to 8 hours if not found.
			tableData.push({
				exchange: this.name,
				symbol: markPrice.s.replace('USDT', ''),
				fr: +markPrice.r / fundingIntervalHours * 24 * 365 * 100,
				markPrice: +markPrice.p,
				indexPrice: +markPrice.i,
				oi: (this._openInterest[markPrice.s] || 0) * +markPrice.p,
			});
		}
		return tableData;
	}
	
}
