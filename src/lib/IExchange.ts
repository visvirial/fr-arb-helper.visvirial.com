
import {
	TableData,
} from '@/lib/util';

export interface IExchange {
	name: string;
	init(): Promise<void>;
	destroy(): void;
	tableData: TableData[];
	isSpotAvailable: boolean;
	isMarginAvailable: boolean;
}

