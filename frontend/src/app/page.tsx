'use client';

import {
	useState,
	useEffect,
} from 'react';

import Image from 'next/image';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Paper from '@mui/material/Paper';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';

import {
	numberToHR,
	TableData,
} from '@/lib/util';
import { IExchange } from '@/lib/IExchange';
import { Hyperliquid } from '@/lib/Hyperliquid';
import { Okx } from '@/lib/Okx';
import { Bybit } from '@/lib/Bybit';
import { Bitget } from '@/lib/Bitget';
import { Binance } from '@/lib/Binance';
import { Aster } from '@/lib/Aster';

// Define all available exchanges
const allExchanges = [
	{ name: 'Hyperliquid', instance: () => new Hyperliquid() },
	{ name: 'OKX', instance: () => new Okx() },
	{ name: 'Bybit', instance: () => new Bybit() },
	{ name: 'Bitget', instance: () => new Bitget() },
	{ name: 'Binance', instance: () => new Binance() },
	{ name: 'Aster', instance: () => new Aster() },
];

export default function Home() {
	const [tableData, setTableData] = useState<TableData[]>([]);
	const [spotAvailability, setSpotAvailability] = useState<Map<string, Set<string>>>(new Map());
	const [marginAvailability, setMarginAvailability] = useState<Map<string, Set<string>>>(new Map());
	
	// Instantiate all exchanges once at page load
	const [allExchangeInstances] = useState<IExchange[]>(() => 
		allExchanges.map(e => e.instance())
	);
	
	// Load selected exchanges from localStorage or default to all selected
	const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('selectedExchanges');
				if (saved) {
					return new Set(JSON.parse(saved));
				}
			} catch (error) {
				console.error('Failed to load selected exchanges from localStorage:', error);
			}
		}
		return new Set(allExchanges.map(e => e.name));
	});
	
	// Save to localStorage whenever selection changes
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('selectedExchanges', JSON.stringify([...selectedExchanges]));
		}
	}, [selectedExchanges]);
	
	const handleExchangeToggle = (exchangeName: string) => {
		setSelectedExchanges(prev => {
			const newSet = new Set(prev);
			if (newSet.has(exchangeName)) {
				newSet.delete(exchangeName);
			} else {
				newSet.add(exchangeName);
			}
			return newSet;
		});
	};
	
	useEffect(() => {
		const exchanges: IExchange[] = allExchangeInstances
			.filter(e => selectedExchanges.has(e.name));
		
		// Don't proceed if no exchanges are selected
		if (exchanges.length === 0) {
			setTableData([]);
			setSpotAvailability(new Map());
			setMarginAvailability(new Map());
			return;
		}
		
		let intervalId: ReturnType<typeof setInterval> | null = null;
		
		const recomputeTableData = () => {
			const tableData: TableData[] = [];
			exchanges.forEach((exchange) => {
				tableData.push(...exchange.tableData);
			});
			// Sort.
			tableData.sort((a, b) => {
				return b.fr - a.fr;
			});
			// List all symbols.
			const symbols = [...new Set(tableData.map((row) => row.symbol))];
			// Set spot availability.
			const spotAvailability = new Map<string, Set<string>>();
			for(const symbol of symbols) {
				const available = new Set(exchanges.filter((exchange) => exchange.isSpotAvailable(symbol)).map((exchange) => exchange.name));
				spotAvailability.set(symbol, available);
			}
			setSpotAvailability(spotAvailability);
			// Set margin availability.
			const marginAvailability = new Map<string, Set<string>>();
			for(const symbol of symbols) {
				const available = new Set(exchanges.filter((exchange) => exchange.isMarginAvailable(symbol)).map((exchange) => exchange.name));
				marginAvailability.set(symbol, available);
			}
			setMarginAvailability(marginAvailability);
			setTableData(tableData);
		};
		(async () => {
			await Promise.all(exchanges.map((exchange) => exchange.init()));
			intervalId = setInterval(recomputeTableData, 1000);
		})();
		return () => {
			if (intervalId !== null) {
				clearInterval(intervalId);
			}
		};
	}, [selectedExchanges, allExchangeInstances]);
	
	// Cleanup all exchanges on unmount
	useEffect(() => {
		return () => {
			allExchangeInstances.forEach((exchange) => exchange.destroy());
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return (
		<div>
			<h1 style={{
					fontSize: '200%',
					textAlign: 'center',
				}}>Funding Rate Arbitrage Helper</h1>
			
			<Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
				<h2 style={{ fontSize: '120%', marginBottom: '10px' }}>Select Exchanges</h2>
				<FormGroup row sx={{ justifyContent: 'center' }}>
					{allExchanges.map(exchange => (
						<FormControlLabel
							key={exchange.name}
							control={
								<Checkbox
									checked={selectedExchanges.has(exchange.name)}
									onChange={() => handleExchangeToggle(exchange.name)}
								/>
							}
							label={
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<Image
										src={`/img/${exchange.name.toLowerCase()}.svg`}
										width={20}
										height={20}
										alt={`${exchange.name} exchange logo`}
									/>
									{exchange.name}
								</Box>
							}
						/>
					))}
				</FormGroup>
			</Box>
			
			<TableContainer component={Paper}>
				<Table aria-label="simple table">
					<TableHead>
						<TableRow>
							<TableCell>#</TableCell>
							<TableCell>Exchange</TableCell>
							<TableCell>Coin</TableCell>
							<TableCell align="right">APR</TableCell>
							<TableCell align="right">8h</TableCell>
							<TableCell align="right">1h</TableCell>
							<TableCell>Mark</TableCell>
							<TableCell>Index</TableCell>
							<TableCell align="right">Mark - Index</TableCell>
							<TableCell>OI</TableCell>
							<TableCell>Spot</TableCell>
							<TableCell>Margin</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{[...tableData.entries()].map(([index, row]) => {
							return (
								<TableRow
									key={`${row.exchange}-${row.symbol}`}
								>
									<TableCell>{(index+1).toLocaleString()}</TableCell>
									<TableCell
										style={{
											display: 'flex',
											alignItems: 'center',
											flexWrap: 'wrap',
										}}
									>
										<Image
											src={`/img/${row.exchange.toLowerCase()}.svg`}
											width={20}
											height={20}
											alt={`${row.exchange} exchange logo`}
											style={{
												marginRight: '5px',
											}}
										/>
									</TableCell>
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
									<TableCell>{row.oi === 0 ? 'N/A' : '$' + numberToHR(row.oi)}</TableCell>
									<TableCell>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												flexWrap: 'wrap',
											}}
										>
											{(() => {
												if(spotAvailability.has(row.symbol)) {
													return [...spotAvailability.get(row.symbol)!.values()].map((exchange) => {
														return (
															<Image
																 key={`${exchange}`}
																src={`/img/${exchange.toLowerCase()}.svg`}
																width={20}
																height={20}
																alt={`${exchange} exchange logo`}
																style={{
																	marginRight: '5px',
																}}
															/>
														);
													});
												}
											})()}
										</div>
									</TableCell>
									<TableCell>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												flexWrap: 'wrap',
											}}
										>
											{(() => {
												if(marginAvailability.has(row.symbol)) {
													return [...marginAvailability.get(row.symbol)!.values()].map((exchange) => {
														return (
															<Image
																 key={`${exchange}`}
																src={`/img/${exchange.toLowerCase()}.svg`}
																width={20}
																height={20}
																alt={`${exchange} exchange logo`}
																style={{
																	marginRight: '5px',
																}}
															/>
														);
													});
												}
											})()}
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>
		</div>
	);
}
