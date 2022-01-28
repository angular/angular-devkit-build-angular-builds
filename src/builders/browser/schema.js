"use strict";
// THIS FILE IS AUTOMATICALLY GENERATED. TO UPDATE THIS FILE YOU NEED TO CHANGE THE
// CORRESPONDING JSON SCHEMA FILE, THEN RUN devkit-admin build (or bazel build ...).
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputHashing = exports.InlineStyleLanguage = exports.I18NTranslation = exports.CrossOrigin = exports.Type = void 0;
/**
 * The type of budget.
 */
var Type;
(function (Type) {
    Type["All"] = "all";
    Type["AllScript"] = "allScript";
    Type["Any"] = "any";
    Type["AnyComponentStyle"] = "anyComponentStyle";
    Type["AnyScript"] = "anyScript";
    Type["Bundle"] = "bundle";
    Type["Initial"] = "initial";
})(Type = exports.Type || (exports.Type = {}));
/**
 * Define the crossorigin attribute setting of elements that provide CORS support.
 */
var CrossOrigin;
(function (CrossOrigin) {
    CrossOrigin["Anonymous"] = "anonymous";
    CrossOrigin["None"] = "none";
    CrossOrigin["UseCredentials"] = "use-credentials";
})(CrossOrigin = exports.CrossOrigin || (exports.CrossOrigin = {}));
/**
 * How to handle duplicate translations for i18n.
 *
 * How to handle missing translations for i18n.
 */
var I18NTranslation;
(function (I18NTranslation) {
    I18NTranslation["Error"] = "error";
    I18NTranslation["Ignore"] = "ignore";
    I18NTranslation["Warning"] = "warning";
})(I18NTranslation = exports.I18NTranslation || (exports.I18NTranslation = {}));
/**
 * The stylesheet language to use for the application's inline component styles.
 */
var InlineStyleLanguage;
(function (InlineStyleLanguage) {
    InlineStyleLanguage["Css"] = "css";
    InlineStyleLanguage["Less"] = "less";
    InlineStyleLanguage["Sass"] = "sass";
    InlineStyleLanguage["Scss"] = "scss";
})(InlineStyleLanguage = exports.InlineStyleLanguage || (exports.InlineStyleLanguage = {}));
/**
 * Define the output filename cache-busting hashing mode.
 */
var OutputHashing;
(function (OutputHashing) {
    OutputHashing["All"] = "all";
    OutputHashing["Bundles"] = "bundles";
    OutputHashing["Media"] = "media";
    OutputHashing["None"] = "none";
})(OutputHashing = exports.OutputHashing || (exports.OutputHashing = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZW1hLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBLG1GQUFtRjtBQUNuRixvRkFBb0Y7OztBQTJQcEY7O0dBRUc7QUFDSCxJQUFZLElBUVg7QUFSRCxXQUFZLElBQUk7SUFDWixtQkFBVyxDQUFBO0lBQ1gsK0JBQXVCLENBQUE7SUFDdkIsbUJBQVcsQ0FBQTtJQUNYLCtDQUF1QyxDQUFBO0lBQ3ZDLCtCQUF1QixDQUFBO0lBQ3ZCLHlCQUFpQixDQUFBO0lBQ2pCLDJCQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFSVyxJQUFJLEdBQUosWUFBSSxLQUFKLFlBQUksUUFRZjtBQUVEOztHQUVHO0FBQ0gsSUFBWSxXQUlYO0FBSkQsV0FBWSxXQUFXO0lBQ25CLHNDQUF1QixDQUFBO0lBQ3ZCLDRCQUFhLENBQUE7SUFDYixpREFBa0MsQ0FBQTtBQUN0QyxDQUFDLEVBSlcsV0FBVyxHQUFYLG1CQUFXLEtBQVgsbUJBQVcsUUFJdEI7QUFTRDs7OztHQUlHO0FBQ0gsSUFBWSxlQUlYO0FBSkQsV0FBWSxlQUFlO0lBQ3ZCLGtDQUFlLENBQUE7SUFDZixvQ0FBaUIsQ0FBQTtJQUNqQixzQ0FBbUIsQ0FBQTtBQUN2QixDQUFDLEVBSlcsZUFBZSxHQUFmLHVCQUFlLEtBQWYsdUJBQWUsUUFJMUI7QUFtQkQ7O0dBRUc7QUFDSCxJQUFZLG1CQUtYO0FBTEQsV0FBWSxtQkFBbUI7SUFDM0Isa0NBQVcsQ0FBQTtJQUNYLG9DQUFhLENBQUE7SUFDYixvQ0FBYSxDQUFBO0lBQ2Isb0NBQWEsQ0FBQTtBQUNqQixDQUFDLEVBTFcsbUJBQW1CLEdBQW5CLDJCQUFtQixLQUFuQiwyQkFBbUIsUUFLOUI7QUErREQ7O0dBRUc7QUFDSCxJQUFZLGFBS1g7QUFMRCxXQUFZLGFBQWE7SUFDckIsNEJBQVcsQ0FBQTtJQUNYLG9DQUFtQixDQUFBO0lBQ25CLGdDQUFlLENBQUE7SUFDZiw4QkFBYSxDQUFBO0FBQ2pCLENBQUMsRUFMVyxhQUFhLEdBQWIscUJBQWEsS0FBYixxQkFBYSxRQUt4QiIsInNvdXJjZXNDb250ZW50IjpbIlxuLy8gVEhJUyBGSUxFIElTIEFVVE9NQVRJQ0FMTFkgR0VORVJBVEVELiBUTyBVUERBVEUgVEhJUyBGSUxFIFlPVSBORUVEIFRPIENIQU5HRSBUSEVcbi8vIENPUlJFU1BPTkRJTkcgSlNPTiBTQ0hFTUEgRklMRSwgVEhFTiBSVU4gZGV2a2l0LWFkbWluIGJ1aWxkIChvciBiYXplbCBidWlsZCAuLi4pLlxuXG4vKipcbiAqIEJyb3dzZXIgdGFyZ2V0IG9wdGlvbnNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTY2hlbWEge1xuICAgIC8qKlxuICAgICAqIEEgbGlzdCBvZiBDb21tb25KUyBwYWNrYWdlcyB0aGF0IGFyZSBhbGxvd2VkIHRvIGJlIHVzZWQgd2l0aG91dCBhIGJ1aWxkIHRpbWUgd2FybmluZy5cbiAgICAgKi9cbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbiAgICAvKipcbiAgICAgKiBCdWlsZCB1c2luZyBBaGVhZCBvZiBUaW1lIGNvbXBpbGF0aW9uLlxuICAgICAqL1xuICAgIGFvdD86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBzdGF0aWMgYXBwbGljYXRpb24gYXNzZXRzLlxuICAgICAqL1xuICAgIGFzc2V0cz86IEFzc2V0UGF0dGVybltdO1xuICAgIC8qKlxuICAgICAqIEJhc2UgdXJsIGZvciB0aGUgYXBwbGljYXRpb24gYmVpbmcgYnVpbHQuXG4gICAgICovXG4gICAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQnVkZ2V0IHRocmVzaG9sZHMgdG8gZW5zdXJlIHBhcnRzIG9mIHlvdXIgYXBwbGljYXRpb24gc3RheSB3aXRoaW4gYm91bmRhcmllcyB3aGljaCB5b3VcbiAgICAgKiBzZXQuXG4gICAgICovXG4gICAgYnVkZ2V0cz86IEJ1ZGdldFtdO1xuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgYWR2YW5jZWQgYnVpbGQgb3B0aW1pemF0aW9ucyB3aGVuIHVzaW5nIHRoZSAnYW90JyBvcHRpb24uXG4gICAgICovXG4gICAgYnVpbGRPcHRpbWl6ZXI/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIGEgc2VwZXJhdGUgYnVuZGxlIGNvbnRhaW5pbmcgY29kZSB1c2VkIGFjcm9zcyBtdWx0aXBsZSBidW5kbGVzLlxuICAgICAqL1xuICAgIGNvbW1vbkNodW5rPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBEZWZpbmUgdGhlIGNyb3Nzb3JpZ2luIGF0dHJpYnV0ZSBzZXR0aW5nIG9mIGVsZW1lbnRzIHRoYXQgcHJvdmlkZSBDT1JTIHN1cHBvcnQuXG4gICAgICovXG4gICAgY3Jvc3NPcmlnaW4/OiBDcm9zc09yaWdpbjtcbiAgICAvKipcbiAgICAgKiBEZWxldGUgdGhlIG91dHB1dCBwYXRoIGJlZm9yZSBidWlsZGluZy5cbiAgICAgKi9cbiAgICBkZWxldGVPdXRwdXRQYXRoPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBVUkwgd2hlcmUgZmlsZXMgd2lsbCBiZSBkZXBsb3llZC5cbiAgICAgKiBAZGVwcmVjYXRlZCBVc2UgXCJiYXNlSHJlZlwiIG9wdGlvbiwgXCJBUFBfQkFTRV9IUkVGXCIgREkgdG9rZW4gb3IgYSBjb21iaW5hdGlvbiBvZiBib3RoXG4gICAgICogaW5zdGVhZC4gRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvZGVwbG95bWVudCN0aGUtZGVwbG95LXVybC5cbiAgICAgKi9cbiAgICBkZXBsb3lVcmw/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRXh0cmFjdCBhbGwgbGljZW5zZXMgaW4gYSBzZXBhcmF0ZSBmaWxlLlxuICAgICAqL1xuICAgIGV4dHJhY3RMaWNlbnNlcz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogUmVwbGFjZSBjb21waWxhdGlvbiBzb3VyY2UgZmlsZXMgd2l0aCBvdGhlciBjb21waWxhdGlvbiBzb3VyY2UgZmlsZXMgaW4gdGhlIGJ1aWxkLlxuICAgICAqL1xuICAgIGZpbGVSZXBsYWNlbWVudHM/OiBGaWxlUmVwbGFjZW1lbnRbXTtcbiAgICAvKipcbiAgICAgKiBIb3cgdG8gaGFuZGxlIGR1cGxpY2F0ZSB0cmFuc2xhdGlvbnMgZm9yIGkxOG4uXG4gICAgICovXG4gICAgaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uPzogSTE4TlRyYW5zbGF0aW9uO1xuICAgIC8qKlxuICAgICAqIEhvdyB0byBoYW5kbGUgbWlzc2luZyB0cmFuc2xhdGlvbnMgZm9yIGkxOG4uXG4gICAgICovXG4gICAgaTE4bk1pc3NpbmdUcmFuc2xhdGlvbj86IEkxOE5UcmFuc2xhdGlvbjtcbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHRoZSBnZW5lcmF0aW9uIG9mIHRoZSBhcHBsaWNhdGlvbidzIEhUTUwgaW5kZXguXG4gICAgICovXG4gICAgaW5kZXg6IEluZGV4VW5pb247XG4gICAgLyoqXG4gICAgICogVGhlIHN0eWxlc2hlZXQgbGFuZ3VhZ2UgdG8gdXNlIGZvciB0aGUgYXBwbGljYXRpb24ncyBpbmxpbmUgY29tcG9uZW50IHN0eWxlcy5cbiAgICAgKi9cbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlPzogSW5saW5lU3R5bGVMYW5ndWFnZTtcbiAgICAvKipcbiAgICAgKiBUcmFuc2xhdGUgdGhlIGJ1bmRsZXMgaW4gb25lIG9yIG1vcmUgbG9jYWxlcy5cbiAgICAgKi9cbiAgICBsb2NhbGl6ZT86IExvY2FsaXplO1xuICAgIC8qKlxuICAgICAqIFRoZSBmdWxsIHBhdGggZm9yIHRoZSBtYWluIGVudHJ5IHBvaW50IHRvIHRoZSBhcHAsIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtzcGFjZS5cbiAgICAgKi9cbiAgICBtYWluOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVXNlIGZpbGUgbmFtZSBmb3IgbGF6eSBsb2FkZWQgY2h1bmtzLlxuICAgICAqL1xuICAgIG5hbWVkQ2h1bmtzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIG5nc3ctY29uZmlnLmpzb24uXG4gICAgICovXG4gICAgbmdzd0NvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvcHRpbWl6YXRpb24gb2YgdGhlIGJ1aWxkIG91dHB1dC4gSW5jbHVkaW5nIG1pbmlmaWNhdGlvbiBvZiBzY3JpcHRzIGFuZCBzdHlsZXMsXG4gICAgICogdHJlZS1zaGFraW5nLCBkZWFkLWNvZGUgZWxpbWluYXRpb24sIGlubGluaW5nIG9mIGNyaXRpY2FsIENTUyBhbmQgZm9udHMgaW5saW5pbmcuIEZvclxuICAgICAqIG1vcmUgaW5mb3JtYXRpb24sIHNlZVxuICAgICAqIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS93b3Jrc3BhY2UtY29uZmlnI29wdGltaXphdGlvbi1jb25maWd1cmF0aW9uLlxuICAgICAqL1xuICAgIG9wdGltaXphdGlvbj86IE9wdGltaXphdGlvblVuaW9uO1xuICAgIC8qKlxuICAgICAqIERlZmluZSB0aGUgb3V0cHV0IGZpbGVuYW1lIGNhY2hlLWJ1c3RpbmcgaGFzaGluZyBtb2RlLlxuICAgICAqL1xuICAgIG91dHB1dEhhc2hpbmc/OiBPdXRwdXRIYXNoaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBmdWxsIHBhdGggZm9yIHRoZSBuZXcgb3V0cHV0IGRpcmVjdG9yeSwgcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya3NwYWNlLlxuICAgICAqXG4gICAgICogQnkgZGVmYXVsdCwgd3JpdGVzIG91dHB1dCB0byBhIGZvbGRlciBuYW1lZCBkaXN0LyBpbiB0aGUgY3VycmVudCBwcm9qZWN0LlxuICAgICAqL1xuICAgIG91dHB1dFBhdGg6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBFbmFibGUgYW5kIGRlZmluZSB0aGUgZmlsZSB3YXRjaGluZyBwb2xsIHRpbWUgcGVyaW9kIGluIG1pbGxpc2Vjb25kcy5cbiAgICAgKi9cbiAgICBwb2xsPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSBmdWxsIHBhdGggZm9yIHRoZSBwb2x5ZmlsbHMgZmlsZSwgcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya3NwYWNlLlxuICAgICAqL1xuICAgIHBvbHlmaWxscz86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBEbyBub3QgdXNlIHRoZSByZWFsIHBhdGggd2hlbiByZXNvbHZpbmcgbW9kdWxlcy4gSWYgdW5zZXQgdGhlbiB3aWxsIGRlZmF1bHQgdG8gYHRydWVgIGlmXG4gICAgICogTm9kZUpTIG9wdGlvbiAtLXByZXNlcnZlLXN5bWxpbmtzIGlzIHNldC5cbiAgICAgKi9cbiAgICBwcmVzZXJ2ZVN5bWxpbmtzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBMb2cgcHJvZ3Jlc3MgdG8gdGhlIGNvbnNvbGUgd2hpbGUgYnVpbGRpbmcuXG4gICAgICovXG4gICAgcHJvZ3Jlc3M/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFRoZSBwYXRoIHdoZXJlIHN0eWxlIHJlc291cmNlcyB3aWxsIGJlIHBsYWNlZCwgcmVsYXRpdmUgdG8gb3V0cHV0UGF0aC5cbiAgICAgKi9cbiAgICByZXNvdXJjZXNPdXRwdXRQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEdsb2JhbCBzY3JpcHRzIHRvIGJlIGluY2x1ZGVkIGluIHRoZSBidWlsZC5cbiAgICAgKi9cbiAgICBzY3JpcHRzPzogRXh0cmFFbnRyeVBvaW50W107XG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGEgc2VydmljZSB3b3JrZXIgY29uZmlnIGZvciBwcm9kdWN0aW9uIGJ1aWxkcy5cbiAgICAgKi9cbiAgICBzZXJ2aWNlV29ya2VyPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBTaG93IGNpcmN1bGFyIGRlcGVuZGVuY3kgd2FybmluZ3Mgb24gYnVpbGRzLlxuICAgICAqIEBkZXByZWNhdGVkIFRoZSByZWNvbW1lbmRlZCBtZXRob2QgdG8gZGV0ZWN0IGNpcmN1bGFyIGRlcGVuZGVuY2llcyBpbiBwcm9qZWN0IGNvZGUgaXMgdG9cbiAgICAgKiB1c2UgZWl0aGVyIGEgbGludCBydWxlIG9yIG90aGVyIGV4dGVybmFsIHRvb2xpbmcuXG4gICAgICovXG4gICAgc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBPdXRwdXQgc291cmNlIG1hcHMgZm9yIHNjcmlwdHMgYW5kIHN0eWxlcy4gRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZVxuICAgICAqIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS93b3Jrc3BhY2UtY29uZmlnI3NvdXJjZS1tYXAtY29uZmlndXJhdGlvbi5cbiAgICAgKi9cbiAgICBzb3VyY2VNYXA/OiBTb3VyY2VNYXBVbmlvbjtcbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgYSAnc3RhdHMuanNvbicgZmlsZSB3aGljaCBjYW4gYmUgYW5hbHl6ZWQgdXNpbmcgdG9vbHMgc3VjaCBhc1xuICAgICAqICd3ZWJwYWNrLWJ1bmRsZS1hbmFseXplcicuXG4gICAgICovXG4gICAgc3RhdHNKc29uPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBPcHRpb25zIHRvIHBhc3MgdG8gc3R5bGUgcHJlcHJvY2Vzc29ycy5cbiAgICAgKi9cbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/OiBTdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM7XG4gICAgLyoqXG4gICAgICogR2xvYmFsIHN0eWxlcyB0byBiZSBpbmNsdWRlZCBpbiB0aGUgYnVpbGQuXG4gICAgICovXG4gICAgc3R5bGVzPzogRXh0cmFFbnRyeVBvaW50W107XG4gICAgLyoqXG4gICAgICogRW5hYmxlcyB0aGUgdXNlIG9mIHN1YnJlc291cmNlIGludGVncml0eSB2YWxpZGF0aW9uLlxuICAgICAqL1xuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5PzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBUaGUgZnVsbCBwYXRoIGZvciB0aGUgVHlwZVNjcmlwdCBjb25maWd1cmF0aW9uIGZpbGUsIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtzcGFjZS5cbiAgICAgKi9cbiAgICB0c0NvbmZpZzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIGEgc2VwZXJhdGUgYnVuZGxlIGNvbnRhaW5pbmcgb25seSB2ZW5kb3IgbGlicmFyaWVzLiBUaGlzIG9wdGlvbiBzaG91bGQgb25seSB1c2VkXG4gICAgICogZm9yIGRldmVsb3BtZW50LlxuICAgICAqL1xuICAgIHZlbmRvckNodW5rPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBBZGRzIG1vcmUgZGV0YWlscyB0byBvdXRwdXQgbG9nZ2luZy5cbiAgICAgKi9cbiAgICB2ZXJib3NlPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBSdW4gYnVpbGQgd2hlbiBmaWxlcyBjaGFuZ2UuXG4gICAgICovXG4gICAgd2F0Y2g/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFR5cGVTY3JpcHQgY29uZmlndXJhdGlvbiBmb3IgV2ViIFdvcmtlciBtb2R1bGVzLlxuICAgICAqL1xuICAgIHdlYldvcmtlclRzQ29uZmlnPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBBc3NldFBhdHRlcm4gPSBBc3NldFBhdHRlcm5DbGFzcyB8IHN0cmluZztcblxuZXhwb3J0IGludGVyZmFjZSBBc3NldFBhdHRlcm5DbGFzcyB7XG4gICAgLyoqXG4gICAgICogQWxsb3cgZ2xvYiBwYXR0ZXJucyB0byBmb2xsb3cgc3ltbGluayBkaXJlY3Rvcmllcy4gVGhpcyBhbGxvd3Mgc3ViZGlyZWN0b3JpZXMgb2YgdGhlXG4gICAgICogc3ltbGluayB0byBiZSBzZWFyY2hlZC5cbiAgICAgKi9cbiAgICBmb2xsb3dTeW1saW5rcz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogVGhlIHBhdHRlcm4gdG8gbWF0Y2guXG4gICAgICovXG4gICAgZ2xvYjogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGdsb2JzIHRvIGlnbm9yZS5cbiAgICAgKi9cbiAgICBpZ25vcmU/OiBzdHJpbmdbXTtcbiAgICAvKipcbiAgICAgKiBUaGUgaW5wdXQgZGlyZWN0b3J5IHBhdGggaW4gd2hpY2ggdG8gYXBwbHkgJ2dsb2InLiBEZWZhdWx0cyB0byB0aGUgcHJvamVjdCByb290LlxuICAgICAqL1xuICAgIGlucHV0OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQWJzb2x1dGUgcGF0aCB3aXRoaW4gdGhlIG91dHB1dC5cbiAgICAgKi9cbiAgICBvdXRwdXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWRnZXQge1xuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlbGluZSBzaXplIGZvciBjb21wYXJpc29uLlxuICAgICAqL1xuICAgIGJhc2VsaW5lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSB0aHJlc2hvbGQgZm9yIGVycm9yIHJlbGF0aXZlIHRvIHRoZSBiYXNlbGluZSAobWluICYgbWF4KS5cbiAgICAgKi9cbiAgICBlcnJvcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSB0aHJlc2hvbGQgZm9yIGVycm9yIHJlbGF0aXZlIHRvIHRoZSBiYXNlbGluZS5cbiAgICAgKi9cbiAgICBtYXhpbXVtRXJyb3I/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gdGhyZXNob2xkIGZvciB3YXJuaW5nIHJlbGF0aXZlIHRvIHRoZSBiYXNlbGluZS5cbiAgICAgKi9cbiAgICBtYXhpbXVtV2FybmluZz86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbWluaW11bSB0aHJlc2hvbGQgZm9yIGVycm9yIHJlbGF0aXZlIHRvIHRoZSBiYXNlbGluZS5cbiAgICAgKi9cbiAgICBtaW5pbXVtRXJyb3I/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG1pbmltdW0gdGhyZXNob2xkIGZvciB3YXJuaW5nIHJlbGF0aXZlIHRvIHRoZSBiYXNlbGluZS5cbiAgICAgKi9cbiAgICBtaW5pbXVtV2FybmluZz86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgYnVuZGxlLlxuICAgICAqL1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgYnVkZ2V0LlxuICAgICAqL1xuICAgIHR5cGU6IFR5cGU7XG4gICAgLyoqXG4gICAgICogVGhlIHRocmVzaG9sZCBmb3Igd2FybmluZyByZWxhdGl2ZSB0byB0aGUgYmFzZWxpbmUgKG1pbiAmIG1heCkuXG4gICAgICovXG4gICAgd2FybmluZz86IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaGUgdHlwZSBvZiBidWRnZXQuXG4gKi9cbmV4cG9ydCBlbnVtIFR5cGUge1xuICAgIEFsbCA9IFwiYWxsXCIsXG4gICAgQWxsU2NyaXB0ID0gXCJhbGxTY3JpcHRcIixcbiAgICBBbnkgPSBcImFueVwiLFxuICAgIEFueUNvbXBvbmVudFN0eWxlID0gXCJhbnlDb21wb25lbnRTdHlsZVwiLFxuICAgIEFueVNjcmlwdCA9IFwiYW55U2NyaXB0XCIsXG4gICAgQnVuZGxlID0gXCJidW5kbGVcIixcbiAgICBJbml0aWFsID0gXCJpbml0aWFsXCIsXG59XG5cbi8qKlxuICogRGVmaW5lIHRoZSBjcm9zc29yaWdpbiBhdHRyaWJ1dGUgc2V0dGluZyBvZiBlbGVtZW50cyB0aGF0IHByb3ZpZGUgQ09SUyBzdXBwb3J0LlxuICovXG5leHBvcnQgZW51bSBDcm9zc09yaWdpbiB7XG4gICAgQW5vbnltb3VzID0gXCJhbm9ueW1vdXNcIixcbiAgICBOb25lID0gXCJub25lXCIsXG4gICAgVXNlQ3JlZGVudGlhbHMgPSBcInVzZS1jcmVkZW50aWFsc1wiLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVSZXBsYWNlbWVudCB7XG4gICAgcmVwbGFjZT86ICAgICBzdHJpbmc7XG4gICAgcmVwbGFjZVdpdGg/OiBzdHJpbmc7XG4gICAgc3JjPzogICAgICAgICBzdHJpbmc7XG4gICAgd2l0aD86ICAgICAgICBzdHJpbmc7XG59XG5cbi8qKlxuICogSG93IHRvIGhhbmRsZSBkdXBsaWNhdGUgdHJhbnNsYXRpb25zIGZvciBpMThuLlxuICpcbiAqIEhvdyB0byBoYW5kbGUgbWlzc2luZyB0cmFuc2xhdGlvbnMgZm9yIGkxOG4uXG4gKi9cbmV4cG9ydCBlbnVtIEkxOE5UcmFuc2xhdGlvbiB7XG4gICAgRXJyb3IgPSBcImVycm9yXCIsXG4gICAgSWdub3JlID0gXCJpZ25vcmVcIixcbiAgICBXYXJuaW5nID0gXCJ3YXJuaW5nXCIsXG59XG5cbi8qKlxuICogQ29uZmlndXJlcyB0aGUgZ2VuZXJhdGlvbiBvZiB0aGUgYXBwbGljYXRpb24ncyBIVE1MIGluZGV4LlxuICovXG5leHBvcnQgdHlwZSBJbmRleFVuaW9uID0gSW5kZXhPYmplY3QgfCBzdHJpbmc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5kZXhPYmplY3Qge1xuICAgIC8qKlxuICAgICAqIFRoZSBwYXRoIG9mIGEgZmlsZSB0byB1c2UgZm9yIHRoZSBhcHBsaWNhdGlvbidzIGdlbmVyYXRlZCBIVE1MIGluZGV4LlxuICAgICAqL1xuICAgIGlucHV0OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG91dHB1dCBwYXRoIG9mIHRoZSBhcHBsaWNhdGlvbidzIGdlbmVyYXRlZCBIVE1MIGluZGV4IGZpbGUuIFRoZSBmdWxsIHByb3ZpZGVkIHBhdGhcbiAgICAgKiB3aWxsIGJlIHVzZWQgYW5kIHdpbGwgYmUgY29uc2lkZXJlZCByZWxhdGl2ZSB0byB0aGUgYXBwbGljYXRpb24ncyBjb25maWd1cmVkIG91dHB1dCBwYXRoLlxuICAgICAqL1xuICAgIG91dHB1dD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaGUgc3R5bGVzaGVldCBsYW5ndWFnZSB0byB1c2UgZm9yIHRoZSBhcHBsaWNhdGlvbidzIGlubGluZSBjb21wb25lbnQgc3R5bGVzLlxuICovXG5leHBvcnQgZW51bSBJbmxpbmVTdHlsZUxhbmd1YWdlIHtcbiAgICBDc3MgPSBcImNzc1wiLFxuICAgIExlc3MgPSBcImxlc3NcIixcbiAgICBTYXNzID0gXCJzYXNzXCIsXG4gICAgU2NzcyA9IFwic2Nzc1wiLFxufVxuXG4vKipcbiAqIFRyYW5zbGF0ZSB0aGUgYnVuZGxlcyBpbiBvbmUgb3IgbW9yZSBsb2NhbGVzLlxuICovXG5leHBvcnQgdHlwZSBMb2NhbGl6ZSA9IHN0cmluZ1tdIHwgYm9vbGVhbjtcblxuLyoqXG4gKiBFbmFibGVzIG9wdGltaXphdGlvbiBvZiB0aGUgYnVpbGQgb3V0cHV0LiBJbmNsdWRpbmcgbWluaWZpY2F0aW9uIG9mIHNjcmlwdHMgYW5kIHN0eWxlcyxcbiAqIHRyZWUtc2hha2luZywgZGVhZC1jb2RlIGVsaW1pbmF0aW9uLCBpbmxpbmluZyBvZiBjcml0aWNhbCBDU1MgYW5kIGZvbnRzIGlubGluaW5nLiBGb3JcbiAqIG1vcmUgaW5mb3JtYXRpb24sIHNlZVxuICogaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL3dvcmtzcGFjZS1jb25maWcjb3B0aW1pemF0aW9uLWNvbmZpZ3VyYXRpb24uXG4gKi9cbmV4cG9ydCB0eXBlIE9wdGltaXphdGlvblVuaW9uID0gYm9vbGVhbiB8IE9wdGltaXphdGlvbkNsYXNzO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9wdGltaXphdGlvbkNsYXNzIHtcbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9wdGltaXphdGlvbiBmb3IgZm9udHMuIFRoaXMgb3B0aW9uIHJlcXVpcmVzIGludGVybmV0IGFjY2Vzcy4gYEhUVFBTX1BST1hZYFxuICAgICAqIGVudmlyb25tZW50IHZhcmlhYmxlIGNhbiBiZSB1c2VkIHRvIHNwZWNpZnkgYSBwcm94eSBzZXJ2ZXIuXG4gICAgICovXG4gICAgZm9udHM/OiBGb250c1VuaW9uO1xuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3B0aW1pemF0aW9uIG9mIHRoZSBzY3JpcHRzIG91dHB1dC5cbiAgICAgKi9cbiAgICBzY3JpcHRzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9wdGltaXphdGlvbiBvZiB0aGUgc3R5bGVzIG91dHB1dC5cbiAgICAgKi9cbiAgICBzdHlsZXM/OiBTdHlsZXNVbmlvbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIG9wdGltaXphdGlvbiBmb3IgZm9udHMuIFRoaXMgb3B0aW9uIHJlcXVpcmVzIGludGVybmV0IGFjY2Vzcy4gYEhUVFBTX1BST1hZYFxuICogZW52aXJvbm1lbnQgdmFyaWFibGUgY2FuIGJlIHVzZWQgdG8gc3BlY2lmeSBhIHByb3h5IHNlcnZlci5cbiAqL1xuZXhwb3J0IHR5cGUgRm9udHNVbmlvbiA9IGJvb2xlYW4gfCBGb250c0NsYXNzO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZvbnRzQ2xhc3Mge1xuICAgIC8qKlxuICAgICAqIFJlZHVjZSByZW5kZXIgYmxvY2tpbmcgcmVxdWVzdHMgYnkgaW5saW5pbmcgZXh0ZXJuYWwgR29vZ2xlIEZvbnRzIGFuZCBBZG9iZSBGb250cyBDU1NcbiAgICAgKiBkZWZpbml0aW9ucyBpbiB0aGUgYXBwbGljYXRpb24ncyBIVE1MIGluZGV4IGZpbGUuIFRoaXMgb3B0aW9uIHJlcXVpcmVzIGludGVybmV0IGFjY2Vzcy5cbiAgICAgKiBgSFRUUFNfUFJPWFlgIGVudmlyb25tZW50IHZhcmlhYmxlIGNhbiBiZSB1c2VkIHRvIHNwZWNpZnkgYSBwcm94eSBzZXJ2ZXIuXG4gICAgICovXG4gICAgaW5saW5lPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIG9wdGltaXphdGlvbiBvZiB0aGUgc3R5bGVzIG91dHB1dC5cbiAqL1xuZXhwb3J0IHR5cGUgU3R5bGVzVW5pb24gPSBib29sZWFuIHwgU3R5bGVzQ2xhc3M7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVzQ2xhc3Mge1xuICAgIC8qKlxuICAgICAqIEV4dHJhY3QgYW5kIGlubGluZSBjcml0aWNhbCBDU1MgZGVmaW5pdGlvbnMgdG8gaW1wcm92ZSBmaXJzdCBwYWludCB0aW1lLlxuICAgICAqL1xuICAgIGlubGluZUNyaXRpY2FsPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBNaW5pZnkgQ1NTIGRlZmluaXRpb25zIGJ5IHJlbW92aW5nIGV4dHJhbmVvdXMgd2hpdGVzcGFjZSBhbmQgY29tbWVudHMsIG1lcmdpbmdcbiAgICAgKiBpZGVudGlmaWVycyBhbmQgbWluaW1pemluZyB2YWx1ZXMuXG4gICAgICovXG4gICAgbWluaWZ5PzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBEZWZpbmUgdGhlIG91dHB1dCBmaWxlbmFtZSBjYWNoZS1idXN0aW5nIGhhc2hpbmcgbW9kZS5cbiAqL1xuZXhwb3J0IGVudW0gT3V0cHV0SGFzaGluZyB7XG4gICAgQWxsID0gXCJhbGxcIixcbiAgICBCdW5kbGVzID0gXCJidW5kbGVzXCIsXG4gICAgTWVkaWEgPSBcIm1lZGlhXCIsXG4gICAgTm9uZSA9IFwibm9uZVwiLFxufVxuXG5leHBvcnQgdHlwZSBFeHRyYUVudHJ5UG9pbnQgPSBFeHRyYUVudHJ5UG9pbnRDbGFzcyB8IHN0cmluZztcblxuZXhwb3J0IGludGVyZmFjZSBFeHRyYUVudHJ5UG9pbnRDbGFzcyB7XG4gICAgLyoqXG4gICAgICogVGhlIGJ1bmRsZSBuYW1lIGZvciB0aGlzIGV4dHJhIGVudHJ5IHBvaW50LlxuICAgICAqL1xuICAgIGJ1bmRsZU5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogSWYgdGhlIGJ1bmRsZSB3aWxsIGJlIHJlZmVyZW5jZWQgaW4gdGhlIEhUTUwgZmlsZS5cbiAgICAgKi9cbiAgICBpbmplY3Q/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFRoZSBmaWxlIHRvIGluY2x1ZGUuXG4gICAgICovXG4gICAgaW5wdXQ6IHN0cmluZztcbn1cblxuLyoqXG4gKiBPdXRwdXQgc291cmNlIG1hcHMgZm9yIHNjcmlwdHMgYW5kIHN0eWxlcy4gRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZVxuICogaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL3dvcmtzcGFjZS1jb25maWcjc291cmNlLW1hcC1jb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgdHlwZSBTb3VyY2VNYXBVbmlvbiA9IGJvb2xlYW4gfCBTb3VyY2VNYXBDbGFzcztcblxuZXhwb3J0IGludGVyZmFjZSBTb3VyY2VNYXBDbGFzcyB7XG4gICAgLyoqXG4gICAgICogT3V0cHV0IHNvdXJjZSBtYXBzIHVzZWQgZm9yIGVycm9yIHJlcG9ydGluZyB0b29scy5cbiAgICAgKi9cbiAgICBoaWRkZW4/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIE91dHB1dCBzb3VyY2UgbWFwcyBmb3IgYWxsIHNjcmlwdHMuXG4gICAgICovXG4gICAgc2NyaXB0cz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogT3V0cHV0IHNvdXJjZSBtYXBzIGZvciBhbGwgc3R5bGVzLlxuICAgICAqL1xuICAgIHN0eWxlcz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSB2ZW5kb3IgcGFja2FnZXMgc291cmNlIG1hcHMuXG4gICAgICovXG4gICAgdmVuZG9yPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBPcHRpb25zIHRvIHBhc3MgdG8gc3R5bGUgcHJlcHJvY2Vzc29ycy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMge1xuICAgIC8qKlxuICAgICAqIFBhdGhzIHRvIGluY2x1ZGUuIFBhdGhzIHdpbGwgYmUgcmVzb2x2ZWQgdG8gd29ya3NwYWNlIHJvb3QuXG4gICAgICovXG4gICAgaW5jbHVkZVBhdGhzPzogc3RyaW5nW107XG59XG4iXX0=