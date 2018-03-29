"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _request = require("request");
function request(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            url: url,
            headers: Object.assign({ 'Accept': 'text/html' }, headers),
            agentOptions: { rejectUnauthorized: false },
        };
        // tslint:disable-next-line:no-any
        _request(options, (error, response, body) => {
            if (error) {
                reject(error);
            }
            else if (response.statusCode && response.statusCode >= 400) {
                reject(new Error(`Requesting "${url}" returned status code ${response.statusCode}.`));
            }
            else {
                resolve(body);
            }
        });
    });
}
exports.request = request;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci90ZXN0L3V0aWxzL3JlcXVlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFRQSxvQ0FBb0M7QUFFcEMsaUJBQXdCLEdBQVcsRUFBRSxPQUFPLEdBQUcsRUFBRTtJQUMvQyxNQUFNLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDckMsTUFBTSxPQUFPLEdBQUc7WUFDZCxHQUFHLEVBQUUsR0FBRztZQUNSLE9BQU8sa0JBQUksUUFBUSxFQUFFLFdBQVcsSUFBSyxPQUFPLENBQUU7WUFDOUMsWUFBWSxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsS0FBSyxFQUFFO1NBQzVDLENBQUM7UUFDRixrQ0FBa0M7UUFDbEMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQVUsRUFBRSxRQUF5QixFQUFFLElBQVksRUFBRSxFQUFFO1lBQ3hFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hCLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsVUFBVSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzdELE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxlQUFlLEdBQUcsMEJBQTBCLFFBQVEsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDeEYsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoQixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFsQkQsMEJBa0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgSW5jb21pbmdNZXNzYWdlIH0gZnJvbSAnaHR0cCc7XG5pbXBvcnQgKiBhcyBfcmVxdWVzdCBmcm9tICdyZXF1ZXN0JztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3QodXJsOiBzdHJpbmcsIGhlYWRlcnMgPSB7fSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgaGVhZGVyczogeyAnQWNjZXB0JzogJ3RleHQvaHRtbCcsIC4uLmhlYWRlcnMgfSxcbiAgICAgIGFnZW50T3B0aW9uczogeyByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlIH0sXG4gICAgfTtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgX3JlcXVlc3Qob3B0aW9ucywgKGVycm9yOiBhbnksIHJlc3BvbnNlOiBJbmNvbWluZ01lc3NhZ2UsIGJvZHk6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9IGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgJiYgcmVzcG9uc2Uuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgUmVxdWVzdGluZyBcIiR7dXJsfVwiIHJldHVybmVkIHN0YXR1cyBjb2RlICR7cmVzcG9uc2Uuc3RhdHVzQ29kZX0uYCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZShib2R5KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG4iXX0=