
import {
	TableData,
} from '@/lib/util';

export interface IExchange {
	init(): Promise<void>;
	destroy(): void;
	tableData: TableData[];
}

