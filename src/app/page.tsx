'use client';

import {
	useState,
	useEffect,
} from 'react';
import {
	useInterval,
} from 'react-use';

import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Paper from '@mui/material/Paper';

export function numberToHR(n: number, digits: number = 5) {
	const pow = Math.floor(Math.log10(n)) + 1;
	n = (n / Math.pow(10, pow)).toFixed(digits) * Math.pow(10, pow);
	const fractionDigits = Math.max(digits - pow, 0);
	return n.toLocaleString(undefined, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
}

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
	private _intervalId: number | null = null;
	
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
	
	public async destroy() {
		if(this._intervalId !== null) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}
	}
	
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

export class Okx extends EventTarget {
	
	private _ws = new WebSocket(this.wsEndpoint);
	private _initWsPromise: Promise<void>;
	
	private _instruments: any[] = [];
	private _frs: { [instId: string]: any } = {};
	private _markPrices: { [instId: string]: any } = {};
	private _indexPrices: { [instId: string]: any } = {};
	
	constructor(
		public readonly restEndpoint: string = 'https://www.okx.com',
		public readonly wsEndpoint: string = 'wss://ws.okx.com:8443/ws/v5/public',
	) {
		super();
		this._initWsPromise = new Promise<void>((resolve, reject) => {
			this._ws.onopen = resolve;
			this._ws.onerror = reject;
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
	
	public async destroy() {
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
	
	public subscribe(args: any[]) {
		this._ws.send(JSON.stringify({
			op: 'subscribe',
			args,
		}));
	}
	
	public unsubscribe(args: any[]) {
		this._ws.send(JSON.stringify({
			op: 'unsubscribe',
			args,
		}));
	}
	
}

export interface TableData {
	exchange: string;
	symbol: string;
	fr: number;
	markPrice: number;
	indexPrice: number;
}

export default function Home() {
	const [tableData, setTableData] = useState([]);
	useEffect(() => {
		const hyperliquid = new Hyperliquid();
		const okx = new Okx();
		const recomputeTableData = () => {
			const tableData = [];
			// Handle for Hyperliquid.
			{
				const [metas, assetCtxs] = hyperliquid.metaAndAssetCtxs;
				for(let i=0; i<metas.universe.length; i++) {
					const meta = metas.universe[i];
					const assetCtx = assetCtxs[i];
					tableData.push({
						exchange: 'Hyperliquid',
						symbol: meta.name,
						fr: +assetCtx.funding * 24 * 365 * 100,
						markPrice: +assetCtx.markPx,
						indexPrice: +assetCtx.oraclePx,
					});
				}
			}
			// Handle for OKX.
			{
				for(const instId in okx.frs) {
					const fr = okx.frs[instId];
					const inst = okx.instruments.find((inst) => inst.instId === instId);
					tableData.push({
						exchange: 'OKX',
						symbol: instId.split('-')[0],
						fr: +fr.fundingRate * 3 * 365 * 100,
						markPrice: +okx.markPrices[instId].markPx,
						indexPrice: +okx.indexPrices[instId.replace('-SWAP', '')].idxPx,
					});
				}
			}
			// Sort.
			tableData.sort((a, b) => {
				return b.fr - a.fr;
			});
			setTableData(tableData);
		};
		(async () => {
			await hyperliquid.init();
			await okx.init();
			setInterval(recomputeTableData, 100);
		})();
		return async () => {
			await hyperliquid.destroy();
			await okx.destroy();
		};
	}, []);
	return (
		<div>
			<h1 style={{
					fontSize: '200%',
					textAlign: 'center',
				}}>Funding Rate Arbitrage Helper</h1>
			<TableContainer component={Paper}>
				<Table aria-label="simple table">
					<TableHead>
						<TableRow>
							<TableCell>Exchange</TableCell>
							<TableCell>Coin</TableCell>
							<TableCell align="right">FR (APR)</TableCell>
							<TableCell align="right">FR (8h)</TableCell>
							<TableCell align="right">FR (1h)</TableCell>
							<TableCell>Mark Price</TableCell>
							<TableCell>Index Price</TableCell>
							<TableCell align="right">Diff (Mark - Index)</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{tableData.map((row) => {
							return (
								<TableRow
									key={`${row.exchange}-${row.symbol}`}
								>
									<TableCell>{row.exchange}</TableCell>
									<TableCell>{row.symbol}</TableCell>
									<TableCell align="right">{row.fr.toFixed(2)}%</TableCell>
									<TableCell align="right">{(row.fr / 365 / 3).toFixed(4)}%</TableCell>
									<TableCell align="right">{(row.fr / 365 / 24).toFixed(4)}%</TableCell>
									<TableCell
										style={{
											color: row.markPrice > row.indexPrice ? 'green' : 'red',
										}}
									>${numberToHR(row.markPrice)}</TableCell>
									<TableCell>${numberToHR(row.indexPrice)}</TableCell>
									<TableCell
										align="right"
										style={{
											color: row.markPrice > row.indexPrice ? 'green' : 'red',
										}}
									>{((row.markPrice - row.indexPrice) / (row.markPrice + row.indexPrice) * 2 * 100).toFixed(4)}%</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>
		</div>
	);
}

