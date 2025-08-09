
import {
	TableData,
} from '@/lib/util';

export interface IExchange {
	name: string;
	init(): Promise<void>;
	destroy(): void;
	tableData: TableData[];
	isSpotAvailable(symbol: string): boolean;
	isMarginAvailable(symbol: string): boolean;
}
