'use client';

import {
	useState,
	useEffect,
} from 'react';
import {
	useInterval,
} from 'react-use';

import WebSocket from 'ws';

import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

export function numberToHR(n: number, digits: number = 5) {
	const pow = Math.floor(Math.log10(n)) + 1;
	n = (n / Math.pow(10, pow)).toFixed(digits) * Math.pow(10, pow);
	const fractionDigits = Math.min(digits - pow, digits);
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
			// Sort.
			tableData.sort((a, b) => {
				return b.fr - a.fr;
			});
			setTableData(tableData);
		};
		hyperliquid.addEventListener('metaAndAssetCtxs', () => {
			recomputeTableData();
		});
		hyperliquid.init();
		return async () => {
			await hyperliquid.destroy();
		};
	}, []);
	return (
		<div>
			<h1 style={{
					fontSize: '200%',
					textAlign: 'center',
				}}>Funding Rate Arbitrage Helper</h1>
			<TableContainer>
				<Table>
					<TableHead>
						<TableRow>
							<TableCell rowSpan="2">Exchange</TableCell>
							<TableCell rowSpan="2">Coin</TableCell>
							<TableCell colSpan="3">Funding Rate</TableCell>
							<TableCell colSpan="3">Price</TableCell>
						</TableRow>
						<TableRow>
							<TableCell align="right">APR</TableCell>
							<TableCell align="right">8h</TableCell>
							<TableCell align="right">1h</TableCell>
							<TableCell>Mark</TableCell>
							<TableCell>Index</TableCell>
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

