"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BundleActionExecutor = void 0;
const piscina_1 = __importDefault(require("piscina"));
const environment_options_1 = require("./environment-options");
const workerFile = require.resolve('./process-bundle');
class BundleActionExecutor {
    constructor(workerOptions) {
        this.workerOptions = workerOptions;
    }
    ensureWorkerPool() {
        if (this.workerPool) {
            return this.workerPool;
        }
        this.workerPool = new piscina_1.default({
            filename: workerFile,
            name: 'inlineLocales',
            workerData: this.workerOptions,
            maxThreads: environment_options_1.maxWorkers,
        });
        return this.workerPool;
    }
    async inline(action) {
        return this.ensureWorkerPool().run(action, { name: 'inlineLocales' });
    }
    inlineAll(actions) {
        return BundleActionExecutor.executeAll(actions, (action) => this.inline(action));
    }
    static async *executeAll(actions, executor) {
        const executions = new Map();
        for (const action of actions) {
            const execution = executor(action);
            executions.set(execution, execution.then((result) => [execution, result]));
        }
        while (executions.size > 0) {
            const [execution, result] = await Promise.race(executions.values());
            executions.delete(execution);
            yield result;
        }
    }
    stop() {
        var _a;
        void ((_a = this.workerPool) === null || _a === void 0 ? void 0 : _a.destroy());
    }
}
exports.BundleActionExecutor = BundleActionExecutor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uLWV4ZWN1dG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvYWN0aW9uLWV4ZWN1dG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILHNEQUE4QjtBQUM5QiwrREFBbUQ7QUFJbkQsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBRXZELE1BQWEsb0JBQW9CO0lBRy9CLFlBQW9CLGFBQW9DO1FBQXBDLGtCQUFhLEdBQWIsYUFBYSxDQUF1QjtJQUFHLENBQUM7SUFFcEQsZ0JBQWdCO1FBQ3RCLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNuQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7U0FDeEI7UUFFRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksaUJBQU8sQ0FBQztZQUM1QixRQUFRLEVBQUUsVUFBVTtZQUNwQixJQUFJLEVBQUUsZUFBZTtZQUNyQixVQUFVLEVBQUUsSUFBSSxDQUFDLGFBQWE7WUFDOUIsVUFBVSxFQUFFLGdDQUFVO1NBQ3ZCLENBQUMsQ0FBQztRQUVILE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztJQUN6QixDQUFDO0lBRUQsS0FBSyxDQUFDLE1BQU0sQ0FDVixNQUFxQjtRQUVyQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQsU0FBUyxDQUFDLE9BQWdDO1FBQ3hDLE9BQU8sb0JBQW9CLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFTyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUM5QixPQUFvQixFQUNwQixRQUFtQztRQUVuQyxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBd0MsQ0FBQztRQUNuRSxLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sRUFBRTtZQUM1QixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkMsVUFBVSxDQUFDLEdBQUcsQ0FDWixTQUFTLEVBQ1QsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FDaEQsQ0FBQztTQUNIO1FBRUQsT0FBTyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRTtZQUMxQixNQUFNLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUNwRSxVQUFVLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzdCLE1BQU0sTUFBTSxDQUFDO1NBQ2Q7SUFDSCxDQUFDO0lBRUQsSUFBSTs7UUFDRixLQUFLLENBQUEsTUFBQSxJQUFJLENBQUMsVUFBVSwwQ0FBRSxPQUFPLEVBQUUsQ0FBQSxDQUFDO0lBQ2xDLENBQUM7Q0FDRjtBQXJERCxvREFxREMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgSW5saW5lT3B0aW9ucyB9IGZyb20gJy4vcHJvY2Vzcy1idW5kbGUnO1xuXG5jb25zdCB3b3JrZXJGaWxlID0gcmVxdWlyZS5yZXNvbHZlKCcuL3Byb2Nlc3MtYnVuZGxlJyk7XG5cbmV4cG9ydCBjbGFzcyBCdW5kbGVBY3Rpb25FeGVjdXRvciB7XG4gIHByaXZhdGUgd29ya2VyUG9vbD86IFBpc2NpbmE7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSB3b3JrZXJPcHRpb25zOiB7IGkxOG46IEkxOG5PcHRpb25zIH0pIHt9XG5cbiAgcHJpdmF0ZSBlbnN1cmVXb3JrZXJQb29sKCk6IFBpc2NpbmEge1xuICAgIGlmICh0aGlzLndvcmtlclBvb2wpIHtcbiAgICAgIHJldHVybiB0aGlzLndvcmtlclBvb2w7XG4gICAgfVxuXG4gICAgdGhpcy53b3JrZXJQb29sID0gbmV3IFBpc2NpbmEoe1xuICAgICAgZmlsZW5hbWU6IHdvcmtlckZpbGUsXG4gICAgICBuYW1lOiAnaW5saW5lTG9jYWxlcycsXG4gICAgICB3b3JrZXJEYXRhOiB0aGlzLndvcmtlck9wdGlvbnMsXG4gICAgICBtYXhUaHJlYWRzOiBtYXhXb3JrZXJzLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMud29ya2VyUG9vbDtcbiAgfVxuXG4gIGFzeW5jIGlubGluZShcbiAgICBhY3Rpb246IElubGluZU9wdGlvbnMsXG4gICk6IFByb21pc2U8eyBmaWxlOiBzdHJpbmc7IGRpYWdub3N0aWNzOiB7IHR5cGU6IHN0cmluZzsgbWVzc2FnZTogc3RyaW5nIH1bXTsgY291bnQ6IG51bWJlciB9PiB7XG4gICAgcmV0dXJuIHRoaXMuZW5zdXJlV29ya2VyUG9vbCgpLnJ1bihhY3Rpb24sIHsgbmFtZTogJ2lubGluZUxvY2FsZXMnIH0pO1xuICB9XG5cbiAgaW5saW5lQWxsKGFjdGlvbnM6IEl0ZXJhYmxlPElubGluZU9wdGlvbnM+KSB7XG4gICAgcmV0dXJuIEJ1bmRsZUFjdGlvbkV4ZWN1dG9yLmV4ZWN1dGVBbGwoYWN0aW9ucywgKGFjdGlvbikgPT4gdGhpcy5pbmxpbmUoYWN0aW9uKSk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBhc3luYyAqZXhlY3V0ZUFsbDxJLCBPPihcbiAgICBhY3Rpb25zOiBJdGVyYWJsZTxJPixcbiAgICBleGVjdXRvcjogKGFjdGlvbjogSSkgPT4gUHJvbWlzZTxPPixcbiAgKTogQXN5bmNJdGVyYWJsZTxPPiB7XG4gICAgY29uc3QgZXhlY3V0aW9ucyA9IG5ldyBNYXA8UHJvbWlzZTxPPiwgUHJvbWlzZTxbUHJvbWlzZTxPPiwgT10+PigpO1xuICAgIGZvciAoY29uc3QgYWN0aW9uIG9mIGFjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGV4ZWN1dGlvbiA9IGV4ZWN1dG9yKGFjdGlvbik7XG4gICAgICBleGVjdXRpb25zLnNldChcbiAgICAgICAgZXhlY3V0aW9uLFxuICAgICAgICBleGVjdXRpb24udGhlbigocmVzdWx0KSA9PiBbZXhlY3V0aW9uLCByZXN1bHRdKSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgd2hpbGUgKGV4ZWN1dGlvbnMuc2l6ZSA+IDApIHtcbiAgICAgIGNvbnN0IFtleGVjdXRpb24sIHJlc3VsdF0gPSBhd2FpdCBQcm9taXNlLnJhY2UoZXhlY3V0aW9ucy52YWx1ZXMoKSk7XG4gICAgICBleGVjdXRpb25zLmRlbGV0ZShleGVjdXRpb24pO1xuICAgICAgeWllbGQgcmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIHN0b3AoKTogdm9pZCB7XG4gICAgdm9pZCB0aGlzLndvcmtlclBvb2w/LmRlc3Ryb3koKTtcbiAgfVxufVxuIl19