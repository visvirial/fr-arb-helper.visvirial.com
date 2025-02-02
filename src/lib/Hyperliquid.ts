
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
	impactPxs: string[2];
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

export class Hyperliquid extends EventTarget {
	
	private _metaAndAssetCtxs: HLDataMetaAndAssetCtxs = [
		{
			universe: [],
		},
		[],
	];
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	
	constructor(
		public readonly restEndpoint: string = 'https://api.hyperliquid.xyz/info',
	) {
		super();
	}
	
	public async init() {
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
	
	public async fetchMetaAndAssetCtxs() {
		this._metaAndAssetCtxs = await this.fetch({
			type: 'metaAndAssetCtxs',
		});
		this.dispatchEvent(new Event('metaAndAssetCtxs'));
		return this._metaAndAssetCtxs;
	}
	
	public get metaAndAssetCtxs() {
		return this._metaAndAssetCtxs;
	}
	
}

