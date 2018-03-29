import { WebpackConfigOptions } from '../build-options';
/**
+ * license-webpack-plugin has a peer dependency on webpack-sources, list it in a comment to
+ * let the dependency validator know it is used.
+ *
+ * require('webpack-sources')
+ */
export declare function getBrowserConfig(wco: WebpackConfigOptions): {
    devtool: string | boolean;
    resolve: {
        mainFields: string[];
    };
    output: {
        crossOriginLoading: string | boolean;
    };
    optimization: {
        runtimeChunk: string;
        splitChunks: {
            chunks: string;
            cacheGroups: {
                vendors: boolean;
                vendor: boolean | {
                    name: string;
                    chunks: string;
                    test: (module: any, chunks: {
                        name: string;
                    }[]) => boolean;
                } | undefined;
            };
        };
    };
    plugins: any[];
    node: boolean;
};
