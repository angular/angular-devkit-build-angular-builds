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
exports.createJitResourceTransformer = void 0;
const typescript_1 = __importDefault(require("typescript"));
const uri_1 = require("./uri");
/**
 * Creates a TypeScript Transformer to transform Angular Component resource references into
 * static import statements. This transformer is used in Angular's JIT compilation mode to
 * support processing of component resources. When in AOT mode, the Angular AOT compiler handles
 * this processing and this transformer is not used.
 * @param getTypeChecker A function that returns a TypeScript TypeChecker instance for the program.
 * @returns A TypeScript transformer factory.
 */
function createJitResourceTransformer(getTypeChecker) {
    return (context) => {
        const typeChecker = getTypeChecker();
        const nodeFactory = context.factory;
        const resourceImportDeclarations = [];
        const visitNode = (node) => {
            if (typescript_1.default.isClassDeclaration(node)) {
                const decorators = typescript_1.default.getDecorators(node);
                if (!decorators || decorators.length === 0) {
                    return node;
                }
                return nodeFactory.updateClassDeclaration(node, [
                    ...decorators.map((current) => visitDecorator(nodeFactory, current, typeChecker, resourceImportDeclarations)),
                    ...(typescript_1.default.getModifiers(node) ?? []),
                ], node.name, node.typeParameters, node.heritageClauses, node.members);
            }
            return typescript_1.default.visitEachChild(node, visitNode, context);
        };
        return (sourceFile) => {
            const updatedSourceFile = typescript_1.default.visitEachChild(sourceFile, visitNode, context);
            if (resourceImportDeclarations.length > 0) {
                return nodeFactory.updateSourceFile(updatedSourceFile, typescript_1.default.setTextRange(nodeFactory.createNodeArray([...resourceImportDeclarations, ...updatedSourceFile.statements], updatedSourceFile.statements.hasTrailingComma), updatedSourceFile.statements), updatedSourceFile.isDeclarationFile, updatedSourceFile.referencedFiles, updatedSourceFile.typeReferenceDirectives, updatedSourceFile.hasNoDefaultLib, updatedSourceFile.libReferenceDirectives);
            }
            else {
                return updatedSourceFile;
            }
        };
    };
}
exports.createJitResourceTransformer = createJitResourceTransformer;
function visitDecorator(nodeFactory, node, typeChecker, resourceImportDeclarations) {
    const origin = getDecoratorOrigin(node, typeChecker);
    if (!origin || origin.module !== '@angular/core' || origin.name !== 'Component') {
        return node;
    }
    if (!typescript_1.default.isCallExpression(node.expression)) {
        return node;
    }
    const decoratorFactory = node.expression;
    const args = decoratorFactory.arguments;
    if (args.length !== 1 || !typescript_1.default.isObjectLiteralExpression(args[0])) {
        // Unsupported component metadata
        return node;
    }
    const objectExpression = args[0];
    const styleReplacements = [];
    // visit all properties
    let properties = typescript_1.default.visitNodes(objectExpression.properties, (node) => typescript_1.default.isObjectLiteralElementLike(node)
        ? visitComponentMetadata(nodeFactory, node, styleReplacements, resourceImportDeclarations)
        : node);
    // replace properties with updated properties
    if (styleReplacements.length > 0) {
        const styleProperty = nodeFactory.createPropertyAssignment(nodeFactory.createIdentifier('styles'), nodeFactory.createArrayLiteralExpression(styleReplacements));
        properties = nodeFactory.createNodeArray([...properties, styleProperty]);
    }
    return nodeFactory.updateDecorator(node, nodeFactory.updateCallExpression(decoratorFactory, decoratorFactory.expression, decoratorFactory.typeArguments, [nodeFactory.updateObjectLiteralExpression(objectExpression, properties)]));
}
function visitComponentMetadata(nodeFactory, node, styleReplacements, resourceImportDeclarations) {
    if (!typescript_1.default.isPropertyAssignment(node) || typescript_1.default.isComputedPropertyName(node.name)) {
        return node;
    }
    switch (node.name.text) {
        case 'templateUrl':
            // Only analyze string literals
            if (!typescript_1.default.isStringLiteral(node.initializer) &&
                !typescript_1.default.isNoSubstitutionTemplateLiteral(node.initializer)) {
                return node;
            }
            const url = node.initializer.text;
            if (!url) {
                return node;
            }
            return nodeFactory.updatePropertyAssignment(node, nodeFactory.createIdentifier('template'), createResourceImport(nodeFactory, (0, uri_1.generateJitFileUri)(url, 'template'), resourceImportDeclarations));
        case 'styles':
            if (!typescript_1.default.isArrayLiteralExpression(node.initializer)) {
                return node;
            }
            const inlineStyles = typescript_1.default.visitNodes(node.initializer.elements, (node) => {
                if (!typescript_1.default.isStringLiteral(node) && !typescript_1.default.isNoSubstitutionTemplateLiteral(node)) {
                    return node;
                }
                const contents = node.text;
                if (!contents) {
                    // An empty inline style is equivalent to not having a style element
                    return undefined;
                }
                return createResourceImport(nodeFactory, (0, uri_1.generateJitInlineUri)(contents, 'style'), resourceImportDeclarations);
            });
            // Inline styles should be placed first
            styleReplacements.unshift(...inlineStyles);
            // The inline styles will be added afterwards in combination with any external styles
            return undefined;
        case 'styleUrls':
            if (!typescript_1.default.isArrayLiteralExpression(node.initializer)) {
                return node;
            }
            const externalStyles = typescript_1.default.visitNodes(node.initializer.elements, (node) => {
                if (!typescript_1.default.isStringLiteral(node) && !typescript_1.default.isNoSubstitutionTemplateLiteral(node)) {
                    return node;
                }
                const url = node.text;
                if (!url) {
                    return node;
                }
                return createResourceImport(nodeFactory, (0, uri_1.generateJitFileUri)(url, 'style'), resourceImportDeclarations);
            });
            // External styles are applied after any inline styles
            styleReplacements.push(...externalStyles);
            // The external styles will be added afterwards in combination with any inline styles
            return undefined;
        default:
            // All other elements are passed through
            return node;
    }
}
function createResourceImport(nodeFactory, url, resourceImportDeclarations) {
    const urlLiteral = nodeFactory.createStringLiteral(url);
    const importName = nodeFactory.createIdentifier(`__NG_CLI_RESOURCE__${resourceImportDeclarations.length}`);
    resourceImportDeclarations.push(nodeFactory.createImportDeclaration(undefined, nodeFactory.createImportClause(false, importName, undefined), urlLiteral));
    return importName;
}
function getDecoratorOrigin(decorator, typeChecker) {
    if (!typescript_1.default.isCallExpression(decorator.expression)) {
        return null;
    }
    let identifier;
    let name = '';
    if (typescript_1.default.isPropertyAccessExpression(decorator.expression.expression)) {
        identifier = decorator.expression.expression.expression;
        name = decorator.expression.expression.name.text;
    }
    else if (typescript_1.default.isIdentifier(decorator.expression.expression)) {
        identifier = decorator.expression.expression;
    }
    else {
        return null;
    }
    // NOTE: resolver.getReferencedImportDeclaration would work as well but is internal
    const symbol = typeChecker.getSymbolAtLocation(identifier);
    if (symbol && symbol.declarations && symbol.declarations.length > 0) {
        const declaration = symbol.declarations[0];
        let module;
        if (typescript_1.default.isImportSpecifier(declaration)) {
            name = (declaration.propertyName || declaration.name).text;
            module = declaration.parent.parent.parent.moduleSpecifier.text;
        }
        else if (typescript_1.default.isNamespaceImport(declaration)) {
            // Use the name from the decorator namespace property access
            module = declaration.parent.parent.moduleSpecifier.text;
        }
        else if (typescript_1.default.isImportClause(declaration)) {
            name = declaration.name.text;
            module = declaration.parent.moduleSpecifier.text;
        }
        else {
            return null;
        }
        return { name, module };
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0LXJlc291cmNlLXRyYW5zZm9ybWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2ppdC1yZXNvdXJjZS10cmFuc2Zvcm1lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCw0REFBNEI7QUFDNUIsK0JBQWlFO0FBRWpFOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQiw0QkFBNEIsQ0FDMUMsY0FBb0M7SUFFcEMsT0FBTyxDQUFDLE9BQWlDLEVBQUUsRUFBRTtRQUMzQyxNQUFNLFdBQVcsR0FBRyxjQUFjLEVBQUUsQ0FBQztRQUNyQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQ3BDLE1BQU0sMEJBQTBCLEdBQTJCLEVBQUUsQ0FBQztRQUU5RCxNQUFNLFNBQVMsR0FBZSxDQUFDLElBQWEsRUFBRSxFQUFFO1lBQzlDLElBQUksb0JBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDL0IsTUFBTSxVQUFVLEdBQUcsb0JBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBRTFDLElBQUksQ0FBQyxVQUFVLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQzFDLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUVELE9BQU8sV0FBVyxDQUFDLHNCQUFzQixDQUN2QyxJQUFJLEVBQ0o7b0JBQ0UsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FDNUIsY0FBYyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLDBCQUEwQixDQUFDLENBQzlFO29CQUNELEdBQUcsQ0FBQyxvQkFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMs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QyxNQUFNLENBQUMsTUFBTSxDQUFDLGVBQW9DLENBQUMsSUFBSSxDQUFDO1NBQ3RGO2FBQU0sSUFBSSxvQkFBRSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQzVDLDREQUE0RDtZQUM1RCxNQUFNLEdBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBb0MsQ0FBQyxJQUFJLENBQUM7U0FDL0U7YUFBTSxJQUFJLG9CQUFFLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3pDLElBQUksR0FBSSxXQUFXLENBQUMsSUFBc0IsQ0FBQyxJQUFJLENBQUM7WUFDaEQsTUFBTSxHQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsZUFBb0MsQ0FBQyxJQUFJLENBQUM7U0FDeEU7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO0tBQ3pCO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IGdlbmVyYXRlSml0RmlsZVVyaSwgZ2VuZXJhdGVKaXRJbmxpbmVVcmkgfSBmcm9tICcuL3VyaSc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIFR5cGVTY3JpcHQgVHJhbnNmb3JtZXIgdG8gdHJhbnNmb3JtIEFuZ3VsYXIgQ29tcG9uZW50IHJlc291cmNlIHJlZmVyZW5jZXMgaW50b1xuICogc3RhdGljIGltcG9ydCBzdGF0ZW1lbnRzLiBUaGlzIHRyYW5zZm9ybWVyIGlzIHVzZWQgaW4gQW5ndWxhcidzIEpJVCBjb21waWxhdGlvbiBtb2RlIHRvXG4gKiBzdXBwb3J0IHByb2Nlc3Npbmcgb2YgY29tcG9uZW50IHJlc291cmNlcy4gV2hlbiBpbiBBT1QgbW9kZSwgdGhlIEFuZ3VsYXIgQU9UIGNvbXBpbGVyIGhhbmRsZXNcbiAqIHRoaXMgcHJvY2Vzc2luZyBhbmQgdGhpcyB0cmFuc2Zvcm1lciBpcyBub3QgdXNlZC5cbiAqIEBwYXJhbSBnZXRUeXBlQ2hlY2tlciBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIFR5cGVTY3JpcHQgVHlwZUNoZWNrZXIgaW5zdGFuY2UgZm9yIHRoZSBwcm9ncmFtLlxuICogQHJldHVybnMgQSBUeXBlU2NyaXB0IHRyYW5zZm9ybWVyIGZhY3RvcnkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKaXRSZXNvdXJjZVRyYW5zZm9ybWVyKFxuICBnZXRUeXBlQ2hlY2tlcjogKCkgPT4gdHMuVHlwZUNoZWNrZXIsXG4pOiB0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuU291cmNlRmlsZT4ge1xuICByZXR1cm4gKGNvbnRleHQ6IHRzLlRyYW5zZm9ybWF0aW9uQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHR5cGVDaGVja2VyID0gZ2V0VHlwZUNoZWNrZXIoKTtcbiAgICBjb25zdCBub2RlRmFjdG9yeSA9IGNvbnRleHQuZmFjdG9yeTtcbiAgICBjb25zdCByZXNvdXJjZUltcG9ydERlY2xhcmF0aW9uczogdHMuSW1wb3J0RGVjbGFyYXRpb25bXSA9IFtdO1xuXG4gICAgY29uc3QgdmlzaXROb2RlOiB0cy5WaXNpdG9yID0gKG5vZGU6IHRzLk5vZGUpID0+IHtcbiAgICAgIGlmICh0cy5pc0NsYXNzRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgICAgY29uc3QgZGVjb3JhdG9ycyA9IHRzLmdldERlY29yYXRvcnMobm9kZSk7XG5cbiAgICAgICAgaWYgKCFkZWNvcmF0b3JzIHx8IGRlY29yYXRvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9kZUZhY3RvcnkudXBkYXRlQ2xhc3NEZWNsYXJhdGlvbihcbiAgICAgICAgICBub2RlLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIC4uLmRlY29yYXRvcnMubWFwKChjdXJyZW50KSA9PlxuICAgICAgICAgICAgICB2aXNpdERlY29yYXRvcihub2RlRmFjdG9yeSwgY3VycmVudCwgdHlwZUNoZWNrZXIsIHJlc291cmNlSW1wb3J0RGVjbGFyYXRpb25zKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICAuLi4odHMuZ2V0TW9kaWZpZXJzKG5vZGUpID8/IFtdKSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIG5vZGUubmFtZSxcbiAgICAgICAgICBub2RlLnR5cGVQYXJhbWV0ZXJzLFxuICAgICAgICAgIG5vZGUuaGVyaXRhZ2VDbGF1c2VzLFxuICAgICAgICAgIG5vZGUubWVtYmVycyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0Tm9kZSwgY29udGV4dCk7XG4gICAgfTtcblxuICAgIHJldHVybiAoc291cmNlRmlsZSkgPT4ge1xuICAgICAgY29uc3QgdXBkYXRlZFNvdXJjZUZpbGUgPSB0cy52aXNpdEVhY2hDaGlsZChzb3VyY2VGaWxlLCB2aXNpdE5vZGUsIGNvbnRleHQpO1xuXG4gICAgICBpZiAocmVzb3VyY2VJbXBvcnREZWNsYXJhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gbm9kZUZhY3RvcnkudXBkYXRlU291cmNlRmlsZShcbiAgICAgICAgICB1cGRhdGVkU291cmNlRmlsZSxcbiAgICAgICAgICB0cy5zZXRUZXh0UmFuZ2UoXG4gICAgICAgICAgICBub2RlRmFjdG9yeS5jcmVhdGVOb2RlQXJyYXkoXG4gICAgICAgICAgICAgIFsuLi5yZXNvdXJjZUltcG9ydERlY2xhcmF0aW9ucywgLi4udXBkYXRlZFNvdXJjZUZpbGUuc3RhdGVtZW50c10sXG4gICAgICAgICAgICAgIHVwZGF0ZWRTb3VyY2VGaWxlLnN0YXRlbWVudHMuaGFzVHJhaWxpbmdDb21tYSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICB1cGRhdGVkU291cmNlRmlsZS5zdGF0ZW1lbnRzLFxuICAgICAgICAgICksXG4gICAgICAgICAgdXBkYXRlZFNvdXJjZUZpbGUuaXNEZWNsYXJhdGlvbkZpbGUsXG4gICAgICAgICAgdXBkYXRlZFNvdXJjZUZpbGUucmVmZXJlbmNlZEZpbGVzLFxuICAgICAgICAgIHVwZGF0ZWRTb3VyY2VGaWxlLnR5cGVSZWZlcmVuY2VEaXJlY3RpdmVzLFxuICAgICAgICAgIHVwZGF0ZWRTb3VyY2VGaWxlLmhhc05vRGVmYXVsdExpYixcbiAgICAgICAgICB1cGRhdGVkU291cmNlRmlsZS5saWJSZWZlcmVuY2VEaXJlY3RpdmVzLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHVwZGF0ZWRTb3VyY2VGaWxlO1xuICAgICAgfVxuICAgIH07XG4gIH07XG59XG5cbmZ1bmN0aW9uIHZpc2l0RGVjb3JhdG9yKFxuICBub2RlRmFjdG9yeTogdHMuTm9kZUZhY3RvcnksXG4gIG5vZGU6IHRzLkRlY29yYXRvcixcbiAgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLFxuICByZXNvdXJjZUltcG9ydERlY2xhcmF0aW9uczogdHMuSW1wb3J0RGVjbGFyYXRpb25bXSxcbik6IHRzLkRlY29yYXRvciB7XG4gIGNvbnN0IG9yaWdpbiA9IGdldERlY29yYXRvck9yaWdpbihub2RlLCB0eXBlQ2hlY2tlcik7XG4gIGlmICghb3JpZ2luIHx8IG9yaWdpbi5tb2R1bGUgIT09ICdAYW5ndWxhci9jb3JlJyB8fCBvcmlnaW4ubmFtZSAhPT0gJ0NvbXBvbmVudCcpIHtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIGlmICghdHMuaXNDYWxsRXhwcmVzc2lvbihub2RlLmV4cHJlc3Npb24pKSB7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBjb25zdCBkZWNvcmF0b3JGYWN0b3J5ID0gbm9kZS5leHByZXNzaW9uO1xuICBjb25zdCBhcmdzID0gZGVjb3JhdG9yRmFjdG9yeS5hcmd1bWVudHM7XG4gIGlmIChhcmdzLmxlbmd0aCAhPT0gMSB8fCAhdHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihhcmdzWzBdKSkge1xuICAgIC8vIFVuc3VwcG9ydGVkIGNvbXBvbmVudCBtZXRhZGF0YVxuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgY29uc3Qgb2JqZWN0RXhwcmVzc2lvbiA9IGFyZ3NbMF0gYXMgdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb247XG4gIGNvbnN0IHN0eWxlUmVwbGFjZW1lbnRzOiB0cy5FeHByZXNzaW9uW10gPSBbXTtcblxuICAvLyB2aXNpdCBhbGwgcHJvcGVydGllc1xuICBsZXQgcHJvcGVydGllcyA9IHRzLnZpc2l0Tm9kZXMob2JqZWN0RXhwcmVzc2lvbi5wcm9wZXJ0aWVzLCAobm9kZSkgPT5cbiAgICB0cy5pc09iamVjdExpdGVyYWxFbGVtZW50TGlrZShub2RlKVxuICAgICAgPyB2aXNpdENvbXBvbmVudE1ldGFkYXRhKG5vZGVGYWN0b3J5LCBub2RlLCBzdHlsZVJlcGxhY2VtZW50cywgcmVzb3VyY2VJbXBvcnREZWNsYXJhdGlvbnMpXG4gICAgICA6IG5vZGUsXG4gICkgYXMgdHMuTm9kZUFycmF5PHRzLk9iamVjdExpdGVyYWxFbGVtZW50TGlrZT47XG5cbiAgLy8gcmVwbGFjZSBwcm9wZXJ0aWVzIHdpdGggdXBkYXRlZCBwcm9wZXJ0aWVzXG4gIGlmIChzdHlsZVJlcGxhY2VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc3R5bGVQcm9wZXJ0eSA9IG5vZGVGYWN0b3J5LmNyZWF0ZVByb3BlcnR5QXNzaWdubWVudChcbiAgICAgIG5vZGVGYWN0b3J5LmNyZWF0ZUlkZW50aWZpZXIoJ3N0eWxlcycpLFxuICAgICAgbm9kZUZhY3RvcnkuY3JlYXRlQXJyYXlMaXRlcmFsRXhwcmVzc2lvbihzdHlsZVJlcGxhY2VtZW50cyksXG4gICAgKTtcblxuICAgIHByb3BlcnRpZXMgPSBub2RlRmFjdG9yeS5jcmVhdGVOb2RlQXJyYXkoWy4uLnByb3BlcnRpZXMsIHN0eWxlUHJvcGVydHldKTtcbiAgfVxuXG4gIHJldHVybiBub2RlRmFjdG9yeS51cGRhdGVEZWNvcmF0b3IoXG4gICAgbm9kZSxcbiAgICBub2RlRmFjdG9yeS51cGRhdGVDYWxsRXhwcmVzc2lvbihcbiAgICAgIGRlY29yYXRvckZhY3RvcnksXG4gICAgICBkZWNvcmF0b3JGYWN0b3J5LmV4cHJlc3Npb24sXG4gICAgICBkZWNvcmF0b3JGYWN0b3J5LnR5cGVBcmd1bWVudHMsXG4gICAgICBbbm9kZUZhY3RvcnkudXBkYXRlT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24ob2JqZWN0RXhwcmVzc2lvbiwgcHJvcGVydGllcyldLFxuICAgICksXG4gICk7XG59XG5cbmZ1bmN0aW9uIHZpc2l0Q29tcG9uZW50TWV0YWRhdGEoXG4gIG5vZGVGYWN0b3J5OiB0cy5Ob2RlRmFjdG9yeSxcbiAgbm9kZTogdHMuT2JqZWN0TGl0ZXJhbEVsZW1lbnRMaWtlLFxuICBzdHlsZVJlcGxhY2VtZW50czogdHMuRXhwcmVzc2lvbltdLFxuICByZXNvdXJjZUltcG9ydERlY2xhcmF0aW9uczogdHMuSW1wb3J0RGVjbGFyYXRpb25bXSxcbik6IHRzLk9iamVjdExpdGVyYWxFbGVtZW50TGlrZSB8IHVuZGVmaW5lZCB7XG4gIGlmICghdHMuaXNQcm9wZXJ0eUFzc2lnbm1lbnQobm9kZSkgfHwgdHMuaXNDb21wdXRlZFByb3BlcnR5TmFtZShub2RlLm5hbWUpKSB7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBzd2l0Y2ggKG5vZGUubmFtZS50ZXh0KSB7XG4gICAgY2FzZSAndGVtcGxhdGVVcmwnOlxuICAgICAgLy8gT25seSBhbmFseXplIHN0cmluZyBsaXRlcmFsc1xuICAgICAgaWYgKFxuICAgICAgICAhdHMuaXNTdHJpbmdMaXRlcmFsKG5vZGUuaW5pdGlhbGl6ZXIpICYmXG4gICAgICAgICF0cy5pc05vU3Vic3RpdHV0aW9uVGVtcGxhdGVMaXRlcmFsKG5vZGUuaW5pdGlhbGl6ZXIpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHVybCA9IG5vZGUuaW5pdGlhbGl6ZXIudGV4dDtcbiAgICAgIGlmICghdXJsKSB7XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbm9kZUZhY3RvcnkudXBkYXRlUHJvcGVydHlBc3NpZ25tZW50KFxuICAgICAgICBub2RlLFxuICAgICAgICBub2RlRmFjdG9yeS5jcmVhdGVJZGVudGlmaWVyKCd0ZW1wbGF0ZScpLFxuICAgICAgICBjcmVhdGVSZXNvdXJjZUltcG9ydChcbiAgICAgICAgICBub2RlRmFjdG9yeSxcbiAgICAgICAgICBnZW5lcmF0ZUppdEZpbGVVcmkodXJsLCAndGVtcGxhdGUnKSxcbiAgICAgICAgICByZXNvdXJjZUltcG9ydERlY2xhcmF0aW9ucyxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgY2FzZSAnc3R5bGVzJzpcbiAgICAgIGlmICghdHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKG5vZGUuaW5pdGlhbGl6ZXIpKSB7XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpbmxpbmVTdHlsZXMgPSB0cy52aXNpdE5vZGVzKG5vZGUuaW5pdGlhbGl6ZXIuZWxlbWVudHMsIChub2RlKSA9PiB7XG4gICAgICAgIGlmICghdHMuaXNTdHJpbmdMaXRlcmFsKG5vZGUpICYmICF0cy5pc05vU3Vic3RpdHV0aW9uVGVtcGxhdGVMaXRlcmFsKG5vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb250ZW50cyA9IG5vZGUudGV4dDtcbiAgICAgICAgaWYgKCFjb250ZW50cykge1xuICAgICAgICAgIC8vIEFuIGVtcHR5IGlubGluZSBzdHlsZSBpcyBlcXVpdmFsZW50IHRvIG5vdCBoYXZpbmcgYSBzdHlsZSBlbGVtZW50XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjcmVhdGVSZXNvdXJjZUltcG9ydChcbiAgICAgICAgICBub2RlRmFjdG9yeSxcbiAgICAgICAgICBnZW5lcmF0ZUppdElubGluZVVyaShjb250ZW50cywgJ3N0eWxlJyksXG4gICAgICAgICAgcmVzb3VyY2VJbXBvcnREZWNsYXJhdGlvbnMsXG4gICAgICAgICk7XG4gICAgICB9KSBhcyB0cy5Ob2RlQXJyYXk8dHMuRXhwcmVzc2lvbj47XG5cbiAgICAgIC8vIElubGluZSBzdHlsZXMgc2hvdWxkIGJlIHBsYWNlZCBmaXJzdFxuICAgICAgc3R5bGVSZXBsYWNlbWVudHMudW5zaGlmdCguLi5pbmxpbmVTdHlsZXMpO1xuXG4gICAgICAvLyBUaGUgaW5saW5lIHN0eWxlcyB3aWxsIGJlIGFkZGVkIGFmdGVyd2FyZHMgaW4gY29tYmluYXRpb24gd2l0aCBhbnkgZXh0ZXJuYWwgc3R5bGVzXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGNhc2UgJ3N0eWxlVXJscyc6XG4gICAgICBpZiAoIXRzLmlzQXJyYXlMaXRlcmFsRXhwcmVzc2lvbihub2RlLmluaXRpYWxpemVyKSkge1xuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZXh0ZXJuYWxTdHlsZXMgPSB0cy52aXNpdE5vZGVzKG5vZGUuaW5pdGlhbGl6ZXIuZWxlbWVudHMsIChub2RlKSA9PiB7XG4gICAgICAgIGlmICghdHMuaXNTdHJpbmdMaXRlcmFsKG5vZGUpICYmICF0cy5pc05vU3Vic3RpdHV0aW9uVGVtcGxhdGVMaXRlcmFsKG5vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1cmwgPSBub2RlLnRleHQ7XG4gICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3JlYXRlUmVzb3VyY2VJbXBvcnQoXG4gICAgICAgICAgbm9kZUZhY3RvcnksXG4gICAgICAgICAgZ2VuZXJhdGVKaXRGaWxlVXJpKHVybCwgJ3N0eWxlJyksXG4gICAgICAgICAgcmVzb3VyY2VJbXBvcnREZWNsYXJhdGlvbnMsXG4gICAgICAgICk7XG4gICAgICB9KSBhcyB0cy5Ob2RlQXJyYXk8dHMuRXhwcmVzc2lvbj47XG5cbiAgICAgIC8vIEV4dGVybmFsIHN0eWxlcyBhcmUgYXBwbGllZCBhZnRlciBhbnkgaW5saW5lIHN0eWxlc1xuICAgICAgc3R5bGVSZXBsYWNlbWVudHMucHVzaCguLi5leHRlcm5hbFN0eWxlcyk7XG5cbiAgICAgIC8vIFRoZSBleHRlcm5hbCBzdHlsZXMgd2lsbCBiZSBhZGRlZCBhZnRlcndhcmRzIGluIGNvbWJpbmF0aW9uIHdpdGggYW55IGlubGluZSBzdHlsZXNcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIEFsbCBvdGhlciBlbGVtZW50cyBhcmUgcGFzc2VkIHRocm91Z2hcbiAgICAgIHJldHVybiBub2RlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVJlc291cmNlSW1wb3J0KFxuICBub2RlRmFjdG9yeTogdHMuTm9kZUZhY3RvcnksXG4gIHVybDogc3RyaW5nLFxuICByZXNvdXJjZUltcG9ydERlY2xhcmF0aW9uczogdHMuSW1wb3J0RGVjbGFyYXRpb25bXSxcbik6IHRzLklkZW50aWZpZXIge1xuICBjb25zdCB1cmxMaXRlcmFsID0gbm9kZUZhY3RvcnkuY3JlYXRlU3RyaW5nTGl0ZXJhbCh1cmwpO1xuXG4gIGNvbnN0IGltcG9ydE5hbWUgPSBub2RlRmFjdG9yeS5jcmVhdGVJZGVudGlmaWVyKFxuICAgIGBfX05HX0NMSV9SRVNPVVJDRV9fJHtyZXNvdXJjZUltcG9ydERlY2xhcmF0aW9ucy5sZW5ndGh9YCxcbiAgKTtcbiAgcmVzb3VyY2VJbXBvcnREZWNsYXJhdGlvbnMucHVzaChcbiAgICBub2RlRmFjdG9yeS5jcmVhdGVJbXBvcnREZWNsYXJhdGlvbihcbiAgICAgIHVuZGVmaW5lZCxcbiAgICAgIG5vZGVGYWN0b3J5LmNyZWF0ZUltcG9ydENsYXVzZShmYWxzZSwgaW1wb3J0TmFtZSwgdW5kZWZpbmVkKSxcbiAgICAgIHVybExpdGVyYWwsXG4gICAgKSxcbiAgKTtcblxuICByZXR1cm4gaW1wb3J0TmFtZTtcbn1cblxuZnVuY3Rpb24gZ2V0RGVjb3JhdG9yT3JpZ2luKFxuICBkZWNvcmF0b3I6IHRzLkRlY29yYXRvcixcbiAgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLFxuKTogeyBuYW1lOiBzdHJpbmc7IG1vZHVsZTogc3RyaW5nIH0gfCBudWxsIHtcbiAgaWYgKCF0cy5pc0NhbGxFeHByZXNzaW9uKGRlY29yYXRvci5leHByZXNzaW9uKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgbGV0IGlkZW50aWZpZXI6IHRzLk5vZGU7XG4gIGxldCBuYW1lID0gJyc7XG5cbiAgaWYgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKGRlY29yYXRvci5leHByZXNzaW9uLmV4cHJlc3Npb24pKSB7XG4gICAgaWRlbnRpZmllciA9IGRlY29yYXRvci5leHByZXNzaW9uLmV4cHJlc3Npb24uZXhwcmVzc2lvbjtcbiAgICBuYW1lID0gZGVjb3JhdG9yLmV4cHJlc3Npb24uZXhwcmVzc2lvbi5uYW1lLnRleHQ7XG4gIH0gZWxzZSBpZiAodHMuaXNJZGVudGlmaWVyKGRlY29yYXRvci5leHByZXNzaW9uLmV4cHJlc3Npb24pKSB7XG4gICAgaWRlbnRpZmllciA9IGRlY29yYXRvci5leHByZXNzaW9uLmV4cHJlc3Npb247XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBOT1RFOiByZXNvbHZlci5nZXRSZWZlcmVuY2VkSW1wb3J0RGVjbGFyYXRpb24gd291bGQgd29yayBhcyB3ZWxsIGJ1dCBpcyBpbnRlcm5hbFxuICBjb25zdCBzeW1ib2wgPSB0eXBlQ2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGlkZW50aWZpZXIpO1xuICBpZiAoc3ltYm9sICYmIHN5bWJvbC5kZWNsYXJhdGlvbnMgJiYgc3ltYm9sLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZGVjbGFyYXRpb24gPSBzeW1ib2wuZGVjbGFyYXRpb25zWzBdO1xuICAgIGxldCBtb2R1bGU6IHN0cmluZztcblxuICAgIGlmICh0cy5pc0ltcG9ydFNwZWNpZmllcihkZWNsYXJhdGlvbikpIHtcbiAgICAgIG5hbWUgPSAoZGVjbGFyYXRpb24ucHJvcGVydHlOYW1lIHx8IGRlY2xhcmF0aW9uLm5hbWUpLnRleHQ7XG4gICAgICBtb2R1bGUgPSAoZGVjbGFyYXRpb24ucGFyZW50LnBhcmVudC5wYXJlbnQubW9kdWxlU3BlY2lmaWVyIGFzIHRzLlN0cmluZ0xpdGVyYWwpLnRleHQ7XG4gICAgfSBlbHNlIGlmICh0cy5pc05hbWVzcGFjZUltcG9ydChkZWNsYXJhdGlvbikpIHtcbiAgICAgIC8vIFVzZSB0aGUgbmFtZSBmcm9tIHRoZSBkZWNvcmF0b3IgbmFtZXNwYWNlIHByb3BlcnR5IGFjY2Vzc1xuICAgICAgbW9kdWxlID0gKGRlY2xhcmF0aW9uLnBhcmVudC5wYXJlbnQubW9kdWxlU3BlY2lmaWVyIGFzIHRzLlN0cmluZ0xpdGVyYWwpLnRleHQ7XG4gICAgfSBlbHNlIGlmICh0cy5pc0ltcG9ydENsYXVzZShkZWNsYXJhdGlvbikpIHtcbiAgICAgIG5hbWUgPSAoZGVjbGFyYXRpb24ubmFtZSBhcyB0cy5JZGVudGlmaWVyKS50ZXh0O1xuICAgICAgbW9kdWxlID0gKGRlY2xhcmF0aW9uLnBhcmVudC5tb2R1bGVTcGVjaWZpZXIgYXMgdHMuU3RyaW5nTGl0ZXJhbCkudGV4dDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgbmFtZSwgbW9kdWxlIH07XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiJdfQ==