'use client';

import {
	useState,
	useEffect,
} from 'react';

import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Paper from '@mui/material/Paper';

import {
	numberToHR,
} from '@/lib/util';
import { Hyperliquid } from '@/lib/Hyperliquid';
import { Okx } from '@/lib/Okx';

interface TableData {
	exchange: string;
	symbol: string;
	fr: number;
	markPrice: number;
	indexPrice: number;
}

export default function Home() {
	const [tableData, setTableData] = useState<TableData[]>([]);
	useEffect(() => {
		const hyperliquid = new Hyperliquid();
		const okx = new Okx();
		const recomputeTableData = () => {
			const tableData: TableData[] = [];
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
					tableData.push({
						exchange: 'OKX',
						symbol: instId.split('-')[0],
						fr: +okx.frs[instId].fundingRate * 3 * 365 * 100,
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
		return () => {
			hyperliquid.destroy();
			okx.destroy();
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

