import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function generateSortOrder(prev?: number, next?: number): number {
    if (prev !== undefined && next !== undefined) {
        return (prev + next) / 2;
    }
    if (prev !== undefined) {
        return prev + 1.0;
    }
    if (next !== undefined) {
        return next - 1.0;
    }
    return 1.0;
}
