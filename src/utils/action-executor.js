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
    workerOptions;
    workerPool;
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
        if (this.workerPool) {
            // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
            this.workerPool.options.minThreads = 0;
            void this.workerPool.destroy();
        }
    }
}
exports.BundleActionExecutor = BundleActionExecutor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uLWV4ZWN1dG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvYWN0aW9uLWV4ZWN1dG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILHNEQUE4QjtBQUU5QiwrREFBbUQ7QUFHbkQsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBRXZELE1BQWEsb0JBQW9CO0lBR1g7SUFGWixVQUFVLENBQVc7SUFFN0IsWUFBb0IsYUFBb0M7UUFBcEMsa0JBQWEsR0FBYixhQUFhLENBQXVCO0lBQUcsQ0FBQztJQUVwRCxnQkFBZ0I7UUFDdEIsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ25CLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztTQUN4QjtRQUVELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxpQkFBTyxDQUFDO1lBQzVCLFFBQVEsRUFBRSxVQUFVO1lBQ3BCLElBQUksRUFBRSxlQUFlO1lBQ3JCLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUM5QixVQUFVLEVBQUUsZ0NBQVU7U0FDdkIsQ0FBQyxDQUFDO1FBRUgsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3pCLENBQUM7SUFFRCxLQUFLLENBQUMsTUFBTSxDQUNWLE1BQXFCO1FBRXJCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFRCxTQUFTLENBQUMsT0FBZ0M7UUFDeEMsT0FBTyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVPLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQzlCLE9BQW9CLEVBQ3BCLFFBQW1DO1FBRW5DLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUF3QyxDQUFDO1FBQ25FLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFO1lBQzVCLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuQyxVQUFVLENBQUMsR0FBRyxDQUNaLFNBQVMsRUFDVCxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUNoRCxDQUFDO1NBQ0g7UUFFRCxPQUFPLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO1lBQzFCLE1BQU0sQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1lBQ3BFLFVBQVUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0IsTUFBTSxNQUFNLENBQUM7U0FDZDtJQUNILENBQUM7SUFFRCxJQUFJO1FBQ0YsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ25CLG9HQUFvRztZQUNwRyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUNoQztJQUNILENBQUM7Q0FDRjtBQXpERCxvREF5REMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBJbmxpbmVPcHRpb25zIH0gZnJvbSAnLi9idW5kbGUtaW5saW5lLW9wdGlvbnMnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4vZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4vaTE4bi1vcHRpb25zJztcblxuY29uc3Qgd29ya2VyRmlsZSA9IHJlcXVpcmUucmVzb2x2ZSgnLi9wcm9jZXNzLWJ1bmRsZScpO1xuXG5leHBvcnQgY2xhc3MgQnVuZGxlQWN0aW9uRXhlY3V0b3Ige1xuICBwcml2YXRlIHdvcmtlclBvb2w/OiBQaXNjaW5hO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgd29ya2VyT3B0aW9uczogeyBpMThuOiBJMThuT3B0aW9ucyB9KSB7fVxuXG4gIHByaXZhdGUgZW5zdXJlV29ya2VyUG9vbCgpOiBQaXNjaW5hIHtcbiAgICBpZiAodGhpcy53b3JrZXJQb29sKSB7XG4gICAgICByZXR1cm4gdGhpcy53b3JrZXJQb29sO1xuICAgIH1cblxuICAgIHRoaXMud29ya2VyUG9vbCA9IG5ldyBQaXNjaW5hKHtcbiAgICAgIGZpbGVuYW1lOiB3b3JrZXJGaWxlLFxuICAgICAgbmFtZTogJ2lubGluZUxvY2FsZXMnLFxuICAgICAgd29ya2VyRGF0YTogdGhpcy53b3JrZXJPcHRpb25zLFxuICAgICAgbWF4VGhyZWFkczogbWF4V29ya2VycyxcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLndvcmtlclBvb2w7XG4gIH1cblxuICBhc3luYyBpbmxpbmUoXG4gICAgYWN0aW9uOiBJbmxpbmVPcHRpb25zLFxuICApOiBQcm9taXNlPHsgZmlsZTogc3RyaW5nOyBkaWFnbm9zdGljczogeyB0eXBlOiBzdHJpbmc7IG1lc3NhZ2U6IHN0cmluZyB9W107IGNvdW50OiBudW1iZXIgfT4ge1xuICAgIHJldHVybiB0aGlzLmVuc3VyZVdvcmtlclBvb2woKS5ydW4oYWN0aW9uLCB7IG5hbWU6ICdpbmxpbmVMb2NhbGVzJyB9KTtcbiAgfVxuXG4gIGlubGluZUFsbChhY3Rpb25zOiBJdGVyYWJsZTxJbmxpbmVPcHRpb25zPikge1xuICAgIHJldHVybiBCdW5kbGVBY3Rpb25FeGVjdXRvci5leGVjdXRlQWxsKGFjdGlvbnMsIChhY3Rpb24pID0+IHRoaXMuaW5saW5lKGFjdGlvbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgYXN5bmMgKmV4ZWN1dGVBbGw8SSwgTz4oXG4gICAgYWN0aW9uczogSXRlcmFibGU8ST4sXG4gICAgZXhlY3V0b3I6IChhY3Rpb246IEkpID0+IFByb21pc2U8Tz4sXG4gICk6IEFzeW5jSXRlcmFibGU8Tz4ge1xuICAgIGNvbnN0IGV4ZWN1dGlvbnMgPSBuZXcgTWFwPFByb21pc2U8Tz4sIFByb21pc2U8W1Byb21pc2U8Tz4sIE9dPj4oKTtcbiAgICBmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zKSB7XG4gICAgICBjb25zdCBleGVjdXRpb24gPSBleGVjdXRvcihhY3Rpb24pO1xuICAgICAgZXhlY3V0aW9ucy5zZXQoXG4gICAgICAgIGV4ZWN1dGlvbixcbiAgICAgICAgZXhlY3V0aW9uLnRoZW4oKHJlc3VsdCkgPT4gW2V4ZWN1dGlvbiwgcmVzdWx0XSksXG4gICAgICApO1xuICAgIH1cblxuICAgIHdoaWxlIChleGVjdXRpb25zLnNpemUgPiAwKSB7XG4gICAgICBjb25zdCBbZXhlY3V0aW9uLCByZXN1bHRdID0gYXdhaXQgUHJvbWlzZS5yYWNlKGV4ZWN1dGlvbnMudmFsdWVzKCkpO1xuICAgICAgZXhlY3V0aW9ucy5kZWxldGUoZXhlY3V0aW9uKTtcbiAgICAgIHlpZWxkIHJlc3VsdDtcbiAgICB9XG4gIH1cblxuICBzdG9wKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLndvcmtlclBvb2wpIHtcbiAgICAgIC8vIFdvcmthcm91bmQgcGlzY2luYSBidWcgd2hlcmUgYSB3b3JrZXIgdGhyZWFkIHdpbGwgYmUgcmVjcmVhdGVkIGFmdGVyIGRlc3Ryb3kgdG8gbWVldCB0aGUgbWluaW11bS5cbiAgICAgIHRoaXMud29ya2VyUG9vbC5vcHRpb25zLm1pblRocmVhZHMgPSAwO1xuICAgICAgdm9pZCB0aGlzLndvcmtlclBvb2wuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxufVxuIl19