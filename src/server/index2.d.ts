/// <reference types="node" />
import { Path, json, logging, virtualFs } from '@angular-devkit/core';
import { Stats } from 'fs';
import { NormalizedWebpackServerBuilderSchema } from '../utils';
import { Schema as BuildWebpackServerSchema } from './schema';
declare const _default: import("@angular-devkit/architect/src/internal").Builder<json.JsonObject & BuildWebpackServerSchema>;
export default _default;
export declare function buildServerWebpackConfig(root: Path, projectRoot: Path, _host: virtualFs.Host<Stats>, options: NormalizedWebpackServerBuilderSchema, logger: logging.Logger): any;
