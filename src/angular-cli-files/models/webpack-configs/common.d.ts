import { WebpackConfigOptions } from '../build-options';
export declare const buildOptimizerLoader: string;
export declare function getCommonConfig(wco: WebpackConfigOptions): {
    mode: string;
    devtool: boolean;
    resolve: {
        extensions: string[];
        symlinks: boolean;
        modules: string[];
        alias: {};
    };
    resolveLoader: {
        modules: string[];
    };
    context: string;
    entry: {
        [key: string]: string[];
    };
    output: {
        path: string;
        publicPath: string | undefined;
        filename: string;
    };
    performance: {
        hints: boolean;
    };
    module: {
        rules: ({
            test: RegExp;
            loader: string;
            options?: undefined;
        } | {
            test: RegExp;
            loader: string;
            options: {
                name: string;
                limit: number;
            };
        } | {
            test: RegExp;
            sideEffects: boolean;
            parser: {
                system: boolean;
            };
            loader?: undefined;
            options?: undefined;
        } | {
            use: ({
                loader: string;
                options: {
                    cacheDirectory: string;
                    sourceMap?: undefined;
                };
            } | {
                loader: string;
                options: {
                    sourceMap: boolean | undefined;
                    cacheDirectory?: undefined;
                };
            })[];
            test: RegExp;
            sideEffects: boolean;
            parser: {
                system: boolean;
            };
            loader?: undefined;
            options?: undefined;
        } | {
            test: RegExp;
            loader?: undefined;
            options?: undefined;
        } | {
            use: ({
                loader: string;
                options: {
                    cacheDirectory: string;
                    sourceMap?: undefined;
                };
            } | {
                loader: string;
                options: {
                    sourceMap: boolean | undefined;
                    cacheDirectory?: undefined;
                };
            })[];
            test: RegExp;
            loader?: undefined;
            options?: undefined;
        })[];
    };
    optimization: {
        noEmitOnErrors: boolean;
        minimizer: any[];
    };
    plugins: any[];
};
