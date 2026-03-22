
import {
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';

export interface HLDataMeta {
	name: string;
	szDecimals: number;
	maxLeverage: number;
	onlyIsolated?: boolean;
	isDelisted?: boolean;
}

export interface HLDataAssetCtxs {
	dayNtlVlm: string;
	funding: string;
	impactPxs: [string, string];
	markPx: string;
	midPx: string;
	openInterest: string;
	oraclePx: string;
	premium: string;
	prevDayPx: string;
}

export type HLDataMetaAndAssetCtxs = [
	{
		universe: HLDataMeta[];
	},
	HLDataAssetCtxs[],
];

export class Hyperliquid extends EventTarget implements IExchange {
	
	public readonly name: string = 'Hyperliquid';
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _spotMeta: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _perpDexs: any;
	private _metaAndAssetCtxs: { [dexName: string]: HLDataMetaAndAssetCtxs } = {};
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	
	constructor(
		public readonly restEndpoint: string = 'https://api.hyperliquid.xyz/info',
	) {
		super();
	}
	
	public async init() {
		this._spotMeta = await this.fetch({
			type: 'spotMeta',
		});
		this._perpDexs = await this.fetch({
			type: 'perpDexs',
		});
		await this.fetchMetaAndAssetCtxs();
		this._intervalId = setInterval(async () => {
			await this.fetchMetaAndAssetCtxs();
		}, 5 * 1000);
	}
	
	public destroy() {
		if(this._intervalId !== null) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}
	}
	
	public get dexNames(): string[] {
		const dexNames: string[] = ['default'];
		for(const dex of this._perpDexs) {
			if(!dex) continue;
			dexNames.push(dex.name);
		}
		return dexNames;
	}
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetch(body: any) {
		const result = await (await fetch(this.restEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})).json();
		return result;
	}
	
	public async fetchMetaAndAssetCtxsForDex(dexName: string) {
		this._metaAndAssetCtxs[dexName] = await this.fetch({
			type: 'metaAndAssetCtxs',
			dex: (dexName === 'default' ? '' : dexName),
		});
		this.dispatchEvent(new Event('metaAndAssetCtxs'));
		return this._metaAndAssetCtxs[dexName];
	}
	
	public async fetchMetaAndAssetCtxs() {
		for(const dexName of this.dexNames) {
			await this.fetchMetaAndAssetCtxsForDex(dexName);
		}
		return this._metaAndAssetCtxs;
	}
	
	public get metaAndAssetCtxs() {
		return this._metaAndAssetCtxs;
	}
	
	public isSpotAvailable(symbol: string): boolean {
		return (
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this._spotMeta.universe.some((meta: any) => meta.name === `${symbol}/USDC`) ||
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this._spotMeta.universe.some((meta: any) => meta.name === `${symbol}/USDT`) ||
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this._spotMeta.universe.some((meta: any) => meta.name === `${symbol}/USDH`)
		);
	}
	
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public isMarginAvailable(symbol: string): boolean {
		return false;
	}
	
	public get tableData(): TableData[] {
		const tableData: TableData[] = [];
		for(const dexName of this.dexNames) {
			//if(!this.metaAndAssetCtxs[dexName]) continue;
			const [metas, assetCtxs] = this.metaAndAssetCtxs[dexName];
			for(let i=0; i<metas.universe.length; i++) {
				const meta = metas.universe[i];
				const assetCtx = assetCtxs[i];
				const [symbol, market] = (() => {
					if(meta.name.includes(':')) {
						const [dexName, symbol] = meta.name.split(':');
						return [symbol, dexName];
					} else {
						return [meta.name, undefined];
					}
				})();
				tableData.push({
					exchange: this.name,
					symbol,
					market,
					fr: +assetCtx.funding * 24 * 365 * 100,
					markPrice: +assetCtx.markPx,
					indexPrice: +assetCtx.oraclePx,
					oi: +assetCtx.openInterest * +assetCtx.markPx,
				});
			}
		}
		return tableData;
	}
	
}
