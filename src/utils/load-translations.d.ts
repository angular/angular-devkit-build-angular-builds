export declare type TranslationLoader = (path: string) => {
    translation: unknown;
    format: string;
};
export declare function createTranslationLoader(): Promise<TranslationLoader>;
