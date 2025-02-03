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
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';
import { Hyperliquid } from '@/lib/Hyperliquid';
import { Okx } from '@/lib/Okx';
import { Bybit } from '@/lib/Bybit';

export default function Home() {
	const [tableData, setTableData] = useState<TableData[]>([]);
	useEffect(() => {
		const exchanges: IExchange[] = [
			new Hyperliquid(),
			new Okx(),
			new Bybit(),
		];
		const recomputeTableData = () => {
			const tableData: TableData[] = [];
			exchanges.forEach((exchange) => {
				tableData.push(...exchange.tableData);
			});
			// Sort.
			tableData.sort((a, b) => {
				return b.fr - a.fr;
			});
			setTableData(tableData);
		};
		(async () => {
			await Promise.all(exchanges.map((exchange) => exchange.init()));
			setInterval(recomputeTableData, 100);
		})();
		return () => {
			exchanges.forEach((exchange) => exchange.destroy());
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

