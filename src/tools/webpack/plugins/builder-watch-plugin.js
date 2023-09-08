"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuilderWatchPlugin = void 0;
class TimeInfoMap extends Map {
    update(path, timestamp) {
        this.set(path, Object.freeze({ safeTime: timestamp, timestamp }));
    }
    toTimestamps() {
        const timestamps = new Map();
        for (const [file, entry] of this) {
            timestamps.set(file, entry.timestamp);
        }
        return timestamps;
    }
}
class BuilderWatchFileSystem {
    watcherFactory;
    inputFileSystem;
    constructor(watcherFactory, inputFileSystem) {
        this.watcherFactory = watcherFactory;
        this.inputFileSystem = inputFileSystem;
    }
    watch(files, directories, missing, startTime, _options, callback, callbackUndelayed) {
        const watchedFiles = new Set(files);
        const watchedDirectories = new Set(directories);
        const watchedMissing = new Set(missing);
        const timeInfo = new TimeInfoMap();
        for (const file of files) {
            timeInfo.update(file, startTime);
        }
        for (const directory of directories) {
            timeInfo.update(directory, startTime);
        }
        const watcher = this.watcherFactory.watch(files, directories, (events) => {
            if (events.length === 0) {
                return;
            }
            if (callbackUndelayed) {
                process.nextTick(() => callbackUndelayed(events[0].path, events[0].time ?? Date.now()));
            }
            process.nextTick(() => {
                const removals = new Set();
                const fileChanges = new Set();
                const directoryChanges = new Set();
                const missingChanges = new Set();
                for (const event of events) {
                    this.inputFileSystem.purge?.(event.path);
                    if (event.type === 'deleted') {
                        timeInfo.delete(event.path);
                        removals.add(event.path);
                    }
                    else {
                        timeInfo.update(event.path, event.time ?? Date.now());
                        if (watchedFiles.has(event.path)) {
                            fileChanges.add(event.path);
                        }
                        else if (watchedDirectories.has(event.path)) {
                            directoryChanges.add(event.path);
                        }
                        else if (watchedMissing.has(event.path)) {
                            missingChanges.add(event.path);
                        }
                    }
                }
                const timeInfoMap = new Map(timeInfo);
                callback(undefined, timeInfoMap, timeInfoMap, new Set([...fileChanges, ...directoryChanges, ...missingChanges]), removals);
            });
        });
        return {
            close() {
                watcher.close();
            },
            pause() { },
            getFileTimeInfoEntries() {
                return new Map(timeInfo);
            },
            getContextTimeInfoEntries() {
                return new Map(timeInfo);
            },
        };
    }
}
class BuilderWatchPlugin {
    watcherFactory;
    constructor(watcherFactory) {
        this.watcherFactory = watcherFactory;
    }
    apply(compiler) {
        compiler.hooks.environment.tap('BuilderWatchPlugin', () => {
            compiler.watchFileSystem = new BuilderWatchFileSystem(this.watcherFactory, compiler.inputFileSystem);
        });
    }
}
exports.BuilderWatchPlugin = BuilderWatchPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci13YXRjaC1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy93ZWJwYWNrL3BsdWdpbnMvYnVpbGRlci13YXRjaC1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBZ0JILE1BQU0sV0FBWSxTQUFRLEdBQW9EO0lBQzVFLE1BQU0sQ0FBQyxJQUFZLEVBQUUsU0FBaUI7UUFDcEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRCxZQUFZO1FBQ1YsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7UUFDN0MsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLElBQUksRUFBRTtZQUNoQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDdkM7UUFFRCxPQUFPLFVBQVUsQ0FBQztJQUNwQixDQUFDO0NBQ0Y7QUFPRCxNQUFNLHNCQUFzQjtJQUVQO0lBQ0E7SUFGbkIsWUFDbUIsY0FBcUMsRUFDckMsZUFBNEM7UUFENUMsbUJBQWMsR0FBZCxjQUFjLENBQXVCO1FBQ3JDLG9CQUFlLEdBQWYsZUFBZSxDQUE2QjtJQUM1RCxDQUFDO0lBRUosS0FBSyxDQUNILEtBQXVCLEVBQ3ZCLFdBQTZCLEVBQzdCLE9BQXlCLEVBQ3pCLFNBQWlCLEVBQ2pCLFFBQXNCLEVBQ3RCLFFBQXVCLEVBQ3ZCLGlCQUF3RDtRQUV4RCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxNQUFN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QyxDQUFDLENBQUM7UUFFSCxPQUFPO1lBQ0wsS0FBSztnQkFDSCxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDbEIsQ0FBQztZQUNELEtBQUssS0FBSSxDQUFDO1lBQ1Ysc0JBQXNCO2dCQUNwQixPQUFPLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzNCLENBQUM7WUFDRCx5QkFBeUI7Z0JBQ3ZCLE9BQU8sSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDM0IsQ0FBQztTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFFRCxNQUFhLGtCQUFrQjtJQUNBO0lBQTdCLFlBQTZCLGNBQXFDO1FBQXJDLG1CQUFjLEdBQWQsY0FBYyxDQUF1QjtJQUFHLENBQUM7SUFFdEUsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7WUFDeEQsUUFBUSxDQUFDLGVBQWUsR0FBRyxJQUFJLHNCQUFzQixDQUNuRCxJQUFJLENBQUMsY0FBYyxFQUNuQixRQUFRLENBQUMsZUFBZSxDQUN6QixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFYRCxnREFXQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuXG5leHBvcnQgdHlwZSBCdWlsZGVyV2F0Y2hlckNhbGxiYWNrID0gKFxuICBldmVudHM6IEFycmF5PHsgcGF0aDogc3RyaW5nOyB0eXBlOiAnY3JlYXRlZCcgfCAnbW9kaWZpZWQnIHwgJ2RlbGV0ZWQnOyB0aW1lPzogbnVtYmVyIH0+LFxuKSA9PiB2b2lkO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkZXJXYXRjaGVyRmFjdG9yeSB7XG4gIHdhdGNoKFxuICAgIGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICAgIGRpcmVjdG9yaWVzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICAgIGNhbGxiYWNrOiBCdWlsZGVyV2F0Y2hlckNhbGxiYWNrLFxuICApOiB7IGNsb3NlKCk6IHZvaWQgfTtcbn1cblxuY2xhc3MgVGltZUluZm9NYXAgZXh0ZW5kcyBNYXA8c3RyaW5nLCB7IHNhZmVUaW1lOiBudW1iZXI7IHRpbWVzdGFtcDogbnVtYmVyIH0+IHtcbiAgdXBkYXRlKHBhdGg6IHN0cmluZywgdGltZXN0YW1wOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnNldChwYXRoLCBPYmplY3QuZnJlZXplKHsgc2FmZVRpbWU6IHRpbWVzdGFtcCwgdGltZXN0YW1wIH0pKTtcbiAgfVxuXG4gIHRvVGltZXN0YW1wcygpOiBNYXA8c3RyaW5nLCBudW1iZXI+IHtcbiAgICBjb25zdCB0aW1lc3RhbXBzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBmb3IgKGNvbnN0IFtmaWxlLCBlbnRyeV0gb2YgdGhpcykge1xuICAgICAgdGltZXN0YW1wcy5zZXQoZmlsZSwgZW50cnkudGltZXN0YW1wKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGltZXN0YW1wcztcbiAgfVxufVxuXG4vLyBFeHRyYWN0IHdhdGNoIHJlbGF0ZWQgdHlwZXMgZnJvbSB0aGUgV2VicGFjayBjb21waWxlciB0eXBlIHNpbmNlIHRoZXkgYXJlIG5vdCBkaXJlY3RseSBleHBvcnRlZFxudHlwZSBXZWJwYWNrV2F0Y2hGaWxlU3lzdGVtID0gQ29tcGlsZXJbJ3dhdGNoRmlsZVN5c3RlbSddO1xudHlwZSBXYXRjaE9wdGlvbnMgPSBQYXJhbWV0ZXJzPFdlYnBhY2tXYXRjaEZpbGVTeXN0ZW1bJ3dhdGNoJ10+WzRdO1xudHlwZSBXYXRjaENhbGxiYWNrID0gUGFyYW1ldGVyczxXZWJwYWNrV2F0Y2hGaWxlU3lzdGVtWyd3YXRjaCddPls1XTtcblxuY2xhc3MgQnVpbGRlcldhdGNoRmlsZVN5c3RlbSBpbXBsZW1lbnRzIFdlYnBhY2tXYXRjaEZpbGVTeXN0ZW0ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IHdhdGNoZXJGYWN0b3J5OiBCdWlsZGVyV2F0Y2hlckZhY3RvcnksXG4gICAgcHJpdmF0ZSByZWFkb25seSBpbnB1dEZpbGVTeXN0ZW06IENvbXBpbGVyWydpbnB1dEZpbGVTeXN0ZW0nXSxcbiAgKSB7fVxuXG4gIHdhdGNoKFxuICAgIGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICAgIGRpcmVjdG9yaWVzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICAgIG1pc3Npbmc6IEl0ZXJhYmxlPHN0cmluZz4sXG4gICAgc3RhcnRUaW1lOiBudW1iZXIsXG4gICAgX29wdGlvbnM6IFdhdGNoT3B0aW9ucyxcbiAgICBjYWxsYmFjazogV2F0Y2hDYWxsYmFjayxcbiAgICBjYWxsYmFja1VuZGVsYXllZD86IChmaWxlOiBzdHJpbmcsIHRpbWU6IG51bWJlcikgPT4gdm9pZCxcbiAgKTogUmV0dXJuVHlwZTxXZWJwYWNrV2F0Y2hGaWxlU3lzdGVtWyd3YXRjaCddPiB7XG4gICAgY29uc3Qgd2F0Y2hlZEZpbGVzID0gbmV3IFNldChmaWxlcyk7XG4gICAgY29uc3Qgd2F0Y2hlZERpcmVjdG9yaWVzID0gbmV3IFNldChkaXJlY3Rvcmllcyk7XG4gICAgY29uc3Qgd2F0Y2hlZE1pc3NpbmcgPSBuZXcgU2V0KG1pc3NpbmcpO1xuXG4gICAgY29uc3QgdGltZUluZm8gPSBuZXcgVGltZUluZm9NYXAoKTtcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIHRpbWVJbmZvLnVwZGF0ZShmaWxlLCBzdGFydFRpbWUpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGRpcmVjdG9yeSBvZiBkaXJlY3Rvcmllcykge1xuICAgICAgdGltZUluZm8udXBkYXRlKGRpcmVjdG9yeSwgc3RhcnRUaW1lKTtcbiAgICB9XG5cbiAgICBjb25zdCB3YXRjaGVyID0gdGhpcy53YXRjaGVyRmFjdG9yeS53YXRjaChmaWxlcywgZGlyZWN0b3JpZXMsIChldmVudHMpID0+IHtcbiAgICAgIGlmIChldmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNhbGxiYWNrVW5kZWxheWVkKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4gY2FsbGJhY2tVbmRlbGF5ZWQoZXZlbnRzWzBdLnBhdGgsIGV2ZW50c1swXS50aW1lID8/IERhdGUubm93KCkpKTtcbiAgICAgIH1cblxuICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlbW92YWxzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IGZpbGVDaGFuZ2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IGRpcmVjdG9yeUNoYW5nZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgY29uc3QgbWlzc2luZ0NoYW5nZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgICAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIGV2ZW50cykge1xuICAgICAgICAgIHRoaXMuaW5wdXRGaWxlU3lzdGVtLnB1cmdlPy4oZXZlbnQucGF0aCk7XG5cbiAgICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2RlbGV0ZWQnKSB7XG4gICAgICAgICAgICB0aW1lSW5mby5kZWxldGUoZXZlbnQucGF0aCk7XG4gICAgICAgICAgICByZW1vdmFscy5hZGQoZXZlbnQucGF0aCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRpbWVJbmZvLnVwZGF0ZShldmVudC5wYXRoLCBldmVudC50aW1lID8/IERhdGUubm93KCkpO1xuICAgICAgICAgICAgaWYgKHdhdGNoZWRGaWxlcy5oYXMoZXZlbnQucGF0aCkpIHtcbiAgICAgICAgICAgICAgZmlsZUNoYW5nZXMuYWRkKGV2ZW50LnBhdGgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXRjaGVkRGlyZWN0b3JpZXMuaGFzKGV2ZW50LnBhdGgpKSB7XG4gICAgICAgICAgICAgIGRpcmVjdG9yeUNoYW5nZXMuYWRkKGV2ZW50LnBhdGgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXRjaGVkTWlzc2luZy5oYXMoZXZlbnQucGF0aCkpIHtcbiAgICAgICAgICAgICAgbWlzc2luZ0NoYW5nZXMuYWRkKGV2ZW50LnBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRpbWVJbmZvTWFwID0gbmV3IE1hcCh0aW1lSW5mbyk7XG5cbiAgICAgICAgY2FsbGJhY2soXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgIHRpbWVJbmZvTWFwLFxuICAgICAgICAgIHRpbWVJbmZvTWFwLFxuICAgICAgICAgIG5ldyBTZXQoWy4uLmZpbGVDaGFuZ2VzLCAuLi5kaXJlY3RvcnlDaGFuZ2VzLCAuLi5taXNzaW5nQ2hhbmdlc10pLFxuICAgICAgICAgIHJlbW92YWxzLFxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY2xvc2UoKSB7XG4gICAgICAgIHdhdGNoZXIuY2xvc2UoKTtcbiAgICAgIH0sXG4gICAgICBwYXVzZSgpIHt9LFxuICAgICAgZ2V0RmlsZVRpbWVJbmZvRW50cmllcygpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNYXAodGltZUluZm8pO1xuICAgICAgfSxcbiAgICAgIGdldENvbnRleHRUaW1lSW5mb0VudHJpZXMoKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWFwKHRpbWVJbmZvKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVpbGRlcldhdGNoUGx1Z2luIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB3YXRjaGVyRmFjdG9yeTogQnVpbGRlcldhdGNoZXJGYWN0b3J5KSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbXBpbGVyLmhvb2tzLmVudmlyb25tZW50LnRhcCgnQnVpbGRlcldhdGNoUGx1Z2luJywgKCkgPT4ge1xuICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0gbmV3IEJ1aWxkZXJXYXRjaEZpbGVTeXN0ZW0oXG4gICAgICAgIHRoaXMud2F0Y2hlckZhY3RvcnksXG4gICAgICAgIGNvbXBpbGVyLmlucHV0RmlsZVN5c3RlbSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==