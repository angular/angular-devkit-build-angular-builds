export declare function htmlRewritingStream(content: string): Promise<{
    rewriter: import('parse5-html-rewriting-stream');
    transformedContent: Promise<string>;
}>;
