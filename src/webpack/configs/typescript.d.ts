import { ivy } from '@ngtools/webpack';
import { WebpackConfigOptions } from '../../utils/build-options';
export declare function getNonAotConfig(wco: WebpackConfigOptions): {
    module: {
        rules: {
            test: RegExp;
            loader: string;
        }[];
    };
    plugins: ivy.AngularWebpackPlugin[];
};
export declare function getAotConfig(wco: WebpackConfigOptions): {
    module: {
        rules: {
            test: RegExp;
            use: (string | {
                loader: string;
                options: {
                    sourceMap: boolean | undefined;
                };
            })[];
        }[];
    };
    plugins: ivy.AngularWebpackPlugin[];
};
export declare function getTypescriptWorkerPlugin(wco: WebpackConfigOptions, workerTsConfigPath: string): ivy.AngularWebpackPlugin;
