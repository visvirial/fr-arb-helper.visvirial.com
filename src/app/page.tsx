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

export class Hyperliquid {
	
	constructor(
		public readonly restEndpoint: string = 'https://api.hyperliquid.xyz/info',
	) {
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
	
}

export interface TableData {
	exchange: string;
	symbol: string;
	decimals: number;
	fr: number;
	markPrice: number;
	indexPrice: number;
}

export default function Home() {
	const hyperliquid = new Hyperliquid();
	const rawData = {
		hyperliquid: [
			{
				universe: [],
			},
			[],
		],
	};
	const [tableData, setTableData] = useState([]);
	const recomputeTableData = () => {
		const tableData = [];
		// Handle for Hyperliquid.
		for(let i=0; i<rawData.hyperliquid[0].universe.length; i++) {
			const meta = rawData.hyperliquid[0].universe[i];
			const assetCtxs = rawData.hyperliquid[1][i];
			tableData.push({
				exchange: 'Hyperliquid',
				symbol: meta.name,
				decimals: +meta.szDecimals,
				fr: +assetCtxs.funding * 24 * 365 * 100,
				markPrice: +assetCtxs.markPx,
				indexPrice: +assetCtxs.oraclePx,
			});
		}
		tableData.sort((a, b) => {
			return b.fr - a.fr;
		});
		setTableData(tableData);
	};
	const updateHL = async () => {
		rawData.hyperliquid = await hyperliquid.fetch({
			type: 'metaAndAssetCtxs',
		});
	};
	useEffect(() => {
		(async () => {
			await updateHL();
			recomputeTableData();
		})();
	}, []);
	useInterval(async () => {
		await updateHL();
		recomputeTableData();
	}, 5 * 1000);
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
							<TableCell>Exchange</TableCell>
							<TableCell>Coin</TableCell>
							<TableCell align="right">Funding Rate (APR)</TableCell>
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
									<TableCell>${numberToHR(row.markPrice)}</TableCell>
									<TableCell>${numberToHR(row.indexPrice)}</TableCell>
									<TableCell align="right">{((row.markPrice - row.indexPrice) / (row.markPrice + row.indexPrice) * 2 * 100).toFixed(4)}%</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>
		</div>
	);
}

