
export function numberToHR(n: number, digits: number = 5) {
	const pow = Math.floor(Math.log10(n)) + 1;
	n = (+(n / Math.pow(10, pow)).toFixed(digits)) * Math.pow(10, pow);
	const fractionDigits = Math.max(digits - pow, 0);
	return n.toLocaleString(undefined, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
}

export interface TableData {
	exchange: string;
	symbol: string;
	fr: number;
	markPrice: number;
	indexPrice: number;
}

