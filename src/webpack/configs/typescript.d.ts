import { AngularWebpackPlugin } from '@ngtools/webpack';
import { WebpackConfigOptions } from '../../utils/build-options';
export declare function getTypeScriptConfig(wco: WebpackConfigOptions): {
    module: {
        rules: {
            test: RegExp;
            loader: string;
        }[];
    };
    plugins: AngularWebpackPlugin[];
};
export declare function getTypescriptWorkerPlugin(wco: WebpackConfigOptions, workerTsConfigPath: string): AngularWebpackPlugin;
