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
exports.createWorkerTransformer = void 0;
const typescript_1 = __importDefault(require("typescript"));
/**
 * Creates a TypeScript Transformer to process Worker and SharedWorker entry points and transform
 * the URL instances to reference the built and bundled worker code. This uses a callback process
 * similar to the component stylesheets to allow the main esbuild plugin to process files as needed.
 * Unsupported worker expressions will be left in their origin form.
 * @param getTypeChecker A function that returns a TypeScript TypeChecker instance for the program.
 * @returns A TypeScript transformer factory.
 */
function createWorkerTransformer(fileProcessor) {
    return (context) => {
        const nodeFactory = context.factory;
        const visitNode = (node) => {
            // Check if the node is a valid new expression for a Worker or SharedWorker
            // TODO: Add global scope check
            if (!typescript_1.default.isNewExpression(node) ||
                !typescript_1.default.isIdentifier(node.expression) ||
                (node.expression.text !== 'Worker' && node.expression.text !== 'SharedWorker')) {
                // Visit child nodes of non-Worker expressions
                return typescript_1.default.visitEachChild(node, visitNode, context);
            }
            // Worker should have atleast one argument but not more than two
            if (!node.arguments || node.arguments.length < 1 || node.arguments.length > 2) {
                return node;
            }
            // First argument must be a new URL expression
            const workerUrlNode = node.arguments[0];
            // TODO: Add global scope check
            if (!typescript_1.default.isNewExpression(workerUrlNode) ||
                !typescript_1.default.isIdentifier(workerUrlNode.expression) ||
                workerUrlNode.expression.text !== 'URL') {
                return node;
            }
            // URL must have 2 arguments
            if (!workerUrlNode.arguments || workerUrlNode.arguments.length !== 2) {
                return node;
            }
            // URL arguments must be a string and then `import.meta.url`
            if (!typescript_1.default.isStringLiteralLike(workerUrlNode.arguments[0]) ||
                !typescript_1.default.isPropertyAccessExpression(workerUrlNode.arguments[1]) ||
                !typescript_1.default.isMetaProperty(workerUrlNode.arguments[1].expression) ||
                workerUrlNode.arguments[1].name.text !== 'url') {
                return node;
            }
            const filePath = workerUrlNode.arguments[0].text;
            const importer = node.getSourceFile().fileName;
            // Process the file
            const replacementPath = fileProcessor(filePath, importer);
            // Update if the path changed
            if (replacementPath !== filePath) {
                return nodeFactory.updateNewExpression(node, node.expression, node.typeArguments, 
                // Update Worker arguments
                typescript_1.default.setTextRange(nodeFactory.createNodeArray([
                    nodeFactory.updateNewExpression(workerUrlNode, workerUrlNode.expression, workerUrlNode.typeArguments, 
                    // Update URL arguments
                    typescript_1.default.setTextRange(nodeFactory.createNodeArray([
                        nodeFactory.createStringLiteral(replacementPath),
                        workerUrlNode.arguments[1],
                    ], workerUrlNode.arguments.hasTrailingComma), workerUrlNode.arguments)),
                    node.arguments[1],
                ], node.arguments.hasTrailingComma), node.arguments));
            }
            else {
                return node;
            }
        };
        return (sourceFile) => {
            // Skip transformer if there are no Workers
            if (!sourceFile.text.includes('Worker')) {
                return sourceFile;
            }
            return typescript_1.default.visitEachChild(sourceFile, visitNode, context);
        };
    };
}
exports.createWorkerTransformer = createWorkerTransformer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViLXdvcmtlci10cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvYW5ndWxhci93ZWItd29ya2VyLXRyYW5zZm9ybWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILDREQUE0QjtBQUU1Qjs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0IsdUJBQXVCLENBQ3JDLGFBQXlEO0lBRXpELE9BQU8sQ0FBQyxPQUFpQyxFQUFFLEVBQUU7UUFDM0MsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUVwQyxNQUFNLFNBQVMsR0FBZSxDQUFDLElBQWEsRUFBRSxFQUFFO1lBQzlDLDJFQUEyRTtZQUMzRSwrQkFBK0I7WUFDL0IsSUFDRSxDQUFDLG9CQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQztnQkFDekIsQ0FBQyxvQkFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUNqQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxjQUFjLENBQUMsRUFDOUU7Z0JBQ0EsOENBQThDO2dCQUM5QyxPQUFPLG9CQUFFLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDcEQ7WUFFRCxnRUFBZ0U7WUFDaEUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDN0UsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELDhDQUE4QztZQUM5QyxN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aWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBUeXBlU2NyaXB0IFRyYW5zZm9ybWVyIHRvIHByb2Nlc3MgV29ya2VyIGFuZCBTaGFyZWRXb3JrZXIgZW50cnkgcG9pbnRzIGFuZCB0cmFuc2Zvcm1cbiAqIHRoZSBVUkwgaW5zdGFuY2VzIHRvIHJlZmVyZW5jZSB0aGUgYnVpbHQgYW5kIGJ1bmRsZWQgd29ya2VyIGNvZGUuIFRoaXMgdXNlcyBhIGNhbGxiYWNrIHByb2Nlc3NcbiAqIHNpbWlsYXIgdG8gdGhlIGNvbXBvbmVudCBzdHlsZXNoZWV0cyB0byBhbGxvdyB0aGUgbWFpbiBlc2J1aWxkIHBsdWdpbiB0byBwcm9jZXNzIGZpbGVzIGFzIG5lZWRlZC5cbiAqIFVuc3VwcG9ydGVkIHdvcmtlciBleHByZXNzaW9ucyB3aWxsIGJlIGxlZnQgaW4gdGhlaXIgb3JpZ2luIGZvcm0uXG4gKiBAcGFyYW0gZ2V0VHlwZUNoZWNrZXIgQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBUeXBlU2NyaXB0IFR5cGVDaGVja2VyIGluc3RhbmNlIGZvciB0aGUgcHJvZ3JhbS5cbiAqIEByZXR1cm5zIEEgVHlwZVNjcmlwdCB0cmFuc2Zvcm1lciBmYWN0b3J5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV29ya2VyVHJhbnNmb3JtZXIoXG4gIGZpbGVQcm9jZXNzb3I6IChmaWxlOiBzdHJpbmcsIGltcG9ydGVyOiBzdHJpbmcpID0+IHN0cmluZyxcbik6IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPiB7XG4gIHJldHVybiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PiB7XG4gICAgY29uc3Qgbm9kZUZhY3RvcnkgPSBjb250ZXh0LmZhY3Rvcnk7XG5cbiAgICBjb25zdCB2aXNpdE5vZGU6IHRzLlZpc2l0b3IgPSAobm9kZTogdHMuTm9kZSkgPT4ge1xuICAgICAgLy8gQ2hlY2sgaWYgdGhlIG5vZGUgaXMgYSB2YWxpZCBuZXcgZXhwcmVzc2lvbiBmb3IgYSBXb3JrZXIgb3IgU2hhcmVkV29ya2VyXG4gICAgICAvLyBUT0RPOiBBZGQgZ2xvYmFsIHNjb3BlIGNoZWNrXG4gICAgICBpZiAoXG4gICAgICAgICF0cy5pc05ld0V4cHJlc3Npb24obm9kZSkgfHxcbiAgICAgICAgIXRzLmlzSWRlbnRpZmllcihub2RlLmV4cHJlc3Npb24pIHx8XG4gICAgICAgIChub2RlLmV4cHJlc3Npb24udGV4dCAhPT0gJ1dvcmtlcicgJiYgbm9kZS5leHByZXNzaW9uLnRleHQgIT09ICdTaGFyZWRXb3JrZXInKVxuICAgICAgKSB7XG4gICAgICAgIC8vIFZpc2l0IGNoaWxkIG5vZGVzIG9mIG5vbi1Xb3JrZXIgZXhwcmVzc2lvbnNcbiAgICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0Tm9kZSwgY29udGV4dCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdvcmtlciBzaG91bGQgaGF2ZSBhdGxlYXN0IG9uZSBhcmd1bWVudCBidXQgbm90IG1vcmUgdGhhbiB0d29cbiAgICAgIGlmICghbm9kZS5hcmd1bWVudHMgfHwgbm9kZS5hcmd1bWVudHMubGVuZ3RoIDwgMSB8fCBub2RlLmFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgICAgfVxuXG4gICAgICAvLyBGaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgbmV3IFVSTCBleHByZXNzaW9uXG4gICAgICBjb25zdCB3b3JrZXJVcmxOb2RlID0gbm9kZS5hcmd1bWVudHNbMF07XG4gICAgICAvLyBUT0RPOiBBZGQgZ2xvYmFsIHNjb3BlIGNoZWNrXG4gICAgICBpZiAoXG4gICAgICAgICF0cy5pc05ld0V4cHJlc3Npb24od29ya2VyVXJsTm9kZSkgfHxcbiAgICAgICAgIXRzLmlzSWRlbnRpZmllcih3b3JrZXJVcmxOb2RlLmV4cHJlc3Npb24pIHx8XG4gICAgICAgIHdvcmtlclVybE5vZGUuZXhwcmVzc2lvbi50ZXh0ICE9PSAnVVJMJ1xuICAgICAgKSB7XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgICAgfVxuXG4gICAgICAvLyBVUkwgbXVzdCBoYXZlIDIgYXJndW1lbnRzXG4gICAgICBpZiAoIXdvcmtlclVybE5vZGUuYXJndW1lbnRzIHx8IHdvcmtlclVybE5vZGUuYXJndW1lbnRzLmxlbmd0aCAhPT0gMikge1xuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgIH1cblxuICAgICAgLy8gVVJMIGFyZ3VtZW50cyBtdXN0IGJlIGEgc3RyaW5nIGFuZCB0aGVuIGBpbXBvcnQubWV0YS51cmxgXG4gICAgICBpZiAoXG4gICAgICAgICF0cy5pc1N0cmluZ0xpdGVyYWxMaWtlKHdvcmtlclVybE5vZGUuYXJndW1lbnRzWzBdKSB8fFxuICAgICAgICAhdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24od29ya2VyVXJsTm9kZS5hcmd1bWVudHNbMV0pIHx8XG4gICAgICAgICF0cy5pc01ldGFQcm9wZXJ0eSh3b3JrZXJVcmxOb2RlLmFyZ3VtZW50c1sxXS5leHByZXNzaW9uKSB8fFxuICAgICAgICB3b3JrZXJVcmxOb2RlLmFyZ3VtZW50c1sxXS5uYW1lLnRleHQgIT09ICd1cmwnXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbGVQYXRoID0gd29ya2VyVXJsTm9kZS5hcmd1bWVudHNbMF0udGV4dDtcbiAgICAgIGNvbnN0IGltcG9ydGVyID0gbm9kZS5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWU7XG5cbiAgICAgIC8vIFByb2Nlc3MgdGhlIGZpbGVcbiAgICAgIGNvbnN0IHJlcGxhY2VtZW50UGF0aCA9IGZpbGVQcm9jZXNzb3IoZmlsZVBhdGgsIGltcG9ydGVyKTtcblxuICAgICAgLy8gVXBkYXRlIGlmIHRoZSBwYXRoIGNoYW5nZWRcbiAgICAgIGlmIChyZXBsYWNlbWVudFBhdGggIT09IGZpbGVQYXRoKSB7XG4gICAgICAgIHJldHVybiBub2RlRmFjdG9yeS51cGRhdGVOZXdFeHByZXNzaW9uKFxuICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgbm9kZS5leHByZXNzaW9uLFxuICAgICAgICAgIG5vZGUudHlwZUFyZ3VtZW50cyxcbiAgICAgICAgICAvLyBVcGRhdGUgV29ya2VyIGFyZ3VtZW50c1xuICAgICAgICAgIHRzLnNldFRleHRSYW5nZShcbiAgICAgICAgICAgIG5vZGVGYWN0b3J5LmNyZWF0ZU5vZGVBcnJheShcbiAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgIG5vZGVGYWN0b3J5LnVwZGF0ZU5ld0V4cHJlc3Npb24oXG4gICAgICAgICAgICAgICAgICB3b3JrZXJVcmxOb2RlLFxuICAgICAgICAgICAgICAgICAgd29ya2VyVXJsTm9kZS5leHByZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgd29ya2VyVXJsTm9kZS50eXBlQXJndW1lbnRzLFxuICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIFVSTCBhcmd1bWVudHNcbiAgICAgICAgICAgICAgICAgIHRzLnNldFRleHRSYW5nZShcbiAgICAgICAgICAgICAgICAgICAgbm9kZUZhY3RvcnkuY3JlYXRlTm9kZUFycmF5KFxuICAgICAgICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVGYWN0b3J5LmNyZWF0ZVN0cmluZ0xpdGVyYWwocmVwbGFjZW1lbnRQYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdvcmtlclVybE5vZGUuYXJndW1lbnRzWzFdLFxuICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgd29ya2VyVXJsTm9kZS5hcmd1bWVudHMuaGFzVHJhaWxpbmdDb21tYSxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgd29ya2VyVXJsTm9kZS5hcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgbm9kZS5hcmd1bWVudHNbMV0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIG5vZGUuYXJndW1lbnRzLmhhc1RyYWlsaW5nQ29tbWEsXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgbm9kZS5hcmd1bWVudHMsXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIFNraXAgdHJhbnNmb3JtZXIgaWYgdGhlcmUgYXJlIG5vIFdvcmtlcnNcbiAgICAgIGlmICghc291cmNlRmlsZS50ZXh0LmluY2x1ZGVzKCdXb3JrZXInKSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKHNvdXJjZUZpbGUsIHZpc2l0Tm9kZSwgY29udGV4dCk7XG4gICAgfTtcbiAgfTtcbn1cbiJdfQ==