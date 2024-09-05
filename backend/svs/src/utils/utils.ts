type EnvVarType = 'number' | 'string';

export function getEnvVar<T extends number | string>(name: string, type: EnvVarType): T {
    const value = process.env[name];
    if (value === undefined) {
        throw new Error(`Environment variable ${name} is not set`);
    }

    if (type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
            throw new Error(`Environment variable ${name} is not a valid number`);
        }
        return numValue as T;
    } else if (type === 'string') {
        return value as T;
    } else {
        throw new Error(`Unsupported environment variable type: ${type}`);
    }
}


export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export function truncateErrorMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) {
        return message;
    }
    return message.substring(0, maxLength - 3) + '...';
}