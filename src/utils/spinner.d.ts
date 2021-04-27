export declare class Spinner {
    private readonly spinner;
    /** When false, only fail messages will be displayed. */
    enabled: boolean;
    constructor(text?: string);
    set text(text: string);
    succeed(text?: string): void;
    fail(text?: string): void;
    stop(): void;
    start(text?: string): void;
}
