"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIndexOutputFile = exports.getRoutes = void 0;
const fs = __importStar(require("fs"));
const guess_parser_1 = require("guess-parser");
const path = __importStar(require("path"));
const error_1 = require("../../utils/error");
/**
 * Returns the union of routes, the contents of routesFile if given,
 * and the static routes extracted if guessRoutes is set to true.
 */
async function getRoutes(options, tsConfigPath, context) {
    let routes = options.routes || [];
    const { logger, workspaceRoot } = context;
    if (options.routesFile) {
        const routesFilePath = path.join(workspaceRoot, options.routesFile);
        routes = routes.concat(fs
            .readFileSync(routesFilePath, 'utf8')
            .split(/\r?\n/)
            .filter((v) => !!v));
    }
    if (options.guessRoutes && tsConfigPath) {
        try {
            routes = routes.concat((0, guess_parser_1.parseAngularRoutes)(path.join(workspaceRoot, tsConfigPath))
                .map((routeObj) => routeObj.path)
                .filter((route) => !route.includes('*') && !route.includes(':')));
        }
        catch (e) {
            (0, error_1.assertIsError)(e);
            logger.error('Unable to extract routes from application.', { ...e });
        }
    }
    routes = routes.map((r) => (r === '' ? '/' : r));
    return [...new Set(routes)];
}
exports.getRoutes = getRoutes;
/**
 * Returns the name of the index file outputted by the browser builder.
 */
function getIndexOutputFile(options) {
    if (typeof options.index === 'string') {
        return path.basename(options.index);
    }
    else {
        return options.index.output || 'index.html';
    }
}
exports.getIndexOutputFile = getIndexOutputFile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcmVyZW5kZXIvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFLSCx1Q0FBeUI7QUFDekIsK0NBQWtEO0FBQ2xELDJDQUE2QjtBQUM3Qiw2Q0FBa0Q7QUFLbEQ7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLFNBQVMsQ0FDN0IsT0FBZ0MsRUFDaEMsWUFBZ0MsRUFDaEMsT0FBdUI7SUFFdkIsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUM7SUFDbEMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFDMUMsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQ3RCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNwRSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FDcEIsRUFBRTthQUNDLFlBQVksQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDO2FBQ3BDLEtBQUssQ0FBQyxPQUFPLENBQUM7YUFDZCxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FDdEIsQ0FBQztLQUNIO0lBRUQsSUFBSSxPQUFPLENBQUMsV0FBVyxJQUFJLFlBQVksRUFBRTtRQUN2QyxJQUFJO1lBQ0YsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQ3BCLElBQUEsaUNBQWtCLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLENBQUM7aUJBQ3ZELEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztpQkFDaEMsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQ25FLENBQUM7U0FDSDtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBQSxxQkFBYSxFQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWpCLE1BQU0sQ0FBQyxLQUFLLENBQUMsNENBQTRDLEVBQUUsRUFBRSxHQUFHLENBQUMsRUFBMkIsQ0FBQyxDQUFDO1NBQy9GO0tBQ0Y7SUFFRCxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFakQsT0FBTyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUM5QixDQUFDO0FBbENELDhCQWtDQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQUMsT0FBOEI7SUFDL0QsSUFBSSxPQUFPLE9BQU8sQ0FBQyxLQUFLLEtBQUssUUFBUSxFQUFFO1FBQ3JDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDckM7U0FBTTtRQUNMLE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDO0tBQzdDO0FBQ0gsQ0FBQztBQU5ELGdEQU1DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcic7XG5pbXBvcnQgeyBKc29uT2JqZWN0LCBqc29uIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgcGFyc2VBbmd1bGFyUm91dGVzIH0gZnJvbSAnZ3Vlc3MtcGFyc2VyJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG50eXBlIFByZXJlbmRlckJ1aWxkZXJPcHRpb25zID0gU2NoZW1hICYganNvbi5Kc29uT2JqZWN0O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHVuaW9uIG9mIHJvdXRlcywgdGhlIGNvbnRlbnRzIG9mIHJvdXRlc0ZpbGUgaWYgZ2l2ZW4sXG4gKiBhbmQgdGhlIHN0YXRpYyByb3V0ZXMgZXh0cmFjdGVkIGlmIGd1ZXNzUm91dGVzIGlzIHNldCB0byB0cnVlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Um91dGVzKFxuICBvcHRpb25zOiBQcmVyZW5kZXJCdWlsZGVyT3B0aW9ucyxcbiAgdHNDb25maWdQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBsZXQgcm91dGVzID0gb3B0aW9ucy5yb3V0ZXMgfHwgW107XG4gIGNvbnN0IHsgbG9nZ2VyLCB3b3Jrc3BhY2VSb290IH0gPSBjb250ZXh0O1xuICBpZiAob3B0aW9ucy5yb3V0ZXNGaWxlKSB7XG4gICAgY29uc3Qgcm91dGVzRmlsZVBhdGggPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy5yb3V0ZXNGaWxlKTtcbiAgICByb3V0ZXMgPSByb3V0ZXMuY29uY2F0KFxuICAgICAgZnNcbiAgICAgICAgLnJlYWRGaWxlU3luYyhyb3V0ZXNGaWxlUGF0aCwgJ3V0ZjgnKVxuICAgICAgICAuc3BsaXQoL1xccj9cXG4vKVxuICAgICAgICAuZmlsdGVyKCh2KSA9PiAhIXYpLFxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5ndWVzc1JvdXRlcyAmJiB0c0NvbmZpZ1BhdGgpIHtcbiAgICB0cnkge1xuICAgICAgcm91dGVzID0gcm91dGVzLmNvbmNhdChcbiAgICAgICAgcGFyc2VBbmd1bGFyUm91dGVzKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCB0c0NvbmZpZ1BhdGgpKVxuICAgICAgICAgIC5tYXAoKHJvdXRlT2JqKSA9PiByb3V0ZU9iai5wYXRoKVxuICAgICAgICAgIC5maWx0ZXIoKHJvdXRlKSA9PiAhcm91dGUuaW5jbHVkZXMoJyonKSAmJiAhcm91dGUuaW5jbHVkZXMoJzonKSksXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGFzc2VydElzRXJyb3IoZSk7XG5cbiAgICAgIGxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGV4dHJhY3Qgcm91dGVzIGZyb20gYXBwbGljYXRpb24uJywgeyAuLi5lIH0gYXMgdW5rbm93biBhcyBKc29uT2JqZWN0KTtcbiAgICB9XG4gIH1cblxuICByb3V0ZXMgPSByb3V0ZXMubWFwKChyKSA9PiAociA9PT0gJycgPyAnLycgOiByKSk7XG5cbiAgcmV0dXJuIFsuLi5uZXcgU2V0KHJvdXRlcyldO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIG5hbWUgb2YgdGhlIGluZGV4IGZpbGUgb3V0cHV0dGVkIGJ5IHRoZSBicm93c2VyIGJ1aWxkZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zLmluZGV4ID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBwYXRoLmJhc2VuYW1lKG9wdGlvbnMuaW5kZXgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBvcHRpb25zLmluZGV4Lm91dHB1dCB8fCAnaW5kZXguaHRtbCc7XG4gIH1cbn1cbiJdfQ==