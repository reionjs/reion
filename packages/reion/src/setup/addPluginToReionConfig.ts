import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";

/** Import line to merge into `reion.config.ts`. */
export type ReionConfigImportSpec =
  | { kind: "named"; names: string[]; module: string }
  | { kind: "default"; name: string; module: string };

export type AddPluginToReionConfigInput = {
  /** Imports to add or merge (same `module` updates one import declaration). */
  imports?: ReionConfigImportSpec[];
  /** Expressions appended to `plugins: [ ... ]`, e.g. `"PrismaPlugin()"`. */
  pluginExpressions: string[];
  /**
   * Remove existing plugin entries that are calls to these identifiers, e.g. `"PrismaPlugin"`
   * drops `PrismaPlugin()`, `PrismaPlugin({})`, `PrismaPlugin( … )`.
   */
  removePluginCalleeNames?: string[];
  /** Relative to `cwd`. Default: `reion.config.ts`. */
  configFile?: string;
};

export type AddPluginToReionConfigResult =
  | { ok: true; configPath: string; unchanged?: boolean }
  | { ok: false; error: string };

function parseExpression(expr: string, languageVersion: ts.ScriptTarget): ts.Expression {
  const wrapped = `const __reion_plugin_expr = ${expr};`;
  const inner = ts.createSourceFile(
    "expr.ts",
    wrapped,
    languageVersion,
    true,
    ts.ScriptKind.TS,
  );
  const stmt = inner.statements[0];
  if (!stmt || !ts.isVariableStatement(stmt)) {
    throw new Error(`Invalid plugin expression: ${expr}`);
  }
  const decl = stmt.declarationList.declarations[0];
  const init = decl?.initializer;
  if (!init) throw new Error(`Invalid plugin expression: ${expr}`);
  return init;
}

function findConfigObject(sf: ts.SourceFile): ts.ObjectLiteralExpression | null {
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (
          decl.name.getText(sf) === "config" &&
          decl.initializer &&
          ts.isObjectLiteralExpression(decl.initializer)
        ) {
          return decl.initializer;
        }
      }
    }
    if (ts.isExportAssignment(stmt) && ts.isObjectLiteralExpression(stmt.expression)) {
      return stmt.expression;
    }
  }
  return null;
}

function getPluginsProperty(
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
): ts.PropertyAssignment | undefined {
  return obj.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && p.name.getText(sf) === "plugins",
  );
}

function replaceNodeInSourceFile<T extends ts.Node>(
  sf: ts.SourceFile,
  oldNode: T,
  newNode: T,
): ts.SourceFile {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (node === oldNode) return newNode;
      return ts.visitEachChild(node, visit, context);
    };
    return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };
  const out = ts.transform(sf, [transformer]);
  try {
    return out.transformed[0]!;
  } finally {
    out.dispose();
  }
}

function mergeImports(
  sf: ts.SourceFile,
  specs: ReionConfigImportSpec[],
): { sf: ts.SourceFile; changed: boolean } {
  if (specs.length === 0) return { sf, changed: false };
  const factory = ts.factory;
  let statements = [...sf.statements];
  const firstImportIdx = statements.findIndex((s) => ts.isImportDeclaration(s));
  const insertIdx = firstImportIdx === -1 ? 0 : firstImportIdx;

  const prepend: ts.Statement[] = [];
  let changed = false;

  for (const spec of specs) {
    if (spec.kind === "default") {
      const existing = statements.find(
        (s) =>
          ts.isImportDeclaration(s) &&
          s.moduleSpecifier.getText(sf).replace(/["']/g, "") === spec.module,
      ) as ts.ImportDeclaration | undefined;
      if (existing?.importClause?.name?.getText(sf) === spec.name) continue;
      if (existing?.importClause?.name) continue;
      changed = true;
      prepend.push(
        factory.createImportDeclaration(
          undefined,
          factory.createImportClause(false, factory.createIdentifier(spec.name), undefined),
          factory.createStringLiteral(spec.module),
        ),
      );
      continue;
    }

    const mod = spec.module;
    const existingIdx = statements.findIndex(
      (s) =>
        ts.isImportDeclaration(s) &&
        s.moduleSpecifier.getText(sf).replace(/["']/g, "") === mod,
    );

    if (existingIdx === -1) {
      changed = true;
      prepend.push(
        factory.createImportDeclaration(
          undefined,
          factory.createImportClause(
            false,
            undefined,
            factory.createNamedImports(
              spec.names.map((n) =>
                factory.createImportSpecifier(false, undefined, factory.createIdentifier(n)),
              ),
            ),
          ),
          factory.createStringLiteral(mod),
        ),
      );
      continue;
    }

    const decl = statements[existingIdx] as ts.ImportDeclaration;
    const clause = decl.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      changed = true;
      prepend.push(
        factory.createImportDeclaration(
          undefined,
          factory.createImportClause(
            false,
            undefined,
            factory.createNamedImports(
              spec.names.map((n) =>
                factory.createImportSpecifier(false, undefined, factory.createIdentifier(n)),
              ),
            ),
          ),
          factory.createStringLiteral(mod),
        ),
      );
      continue;
    }

    const have = new Set(clause.namedBindings.elements.map((e) => e.name.getText(sf)));
    const toAdd = spec.names.filter((n) => !have.has(n));
    if (toAdd.length === 0) continue;

    changed = true;
    const merged = factory.updateNamedImports(
      clause.namedBindings,
      factory.createNodeArray([
        ...clause.namedBindings.elements,
        ...toAdd.map((n) =>
          factory.createImportSpecifier(false, undefined, factory.createIdentifier(n)),
        ),
      ]),
    );
    const newClause = factory.updateImportClause(clause, clause.isTypeOnly, clause.name, merged);
    statements[existingIdx] = factory.updateImportDeclaration(
      decl,
      decl.modifiers,
      newClause,
      decl.moduleSpecifier,
      decl.attributes,
    );
  }

  if (prepend.length > 0) {
    statements = [...statements.slice(0, insertIdx), ...prepend, ...statements.slice(insertIdx)];
  }

  return { sf: factory.updateSourceFile(sf, statements), changed };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyPluginExpressions(
  sf: ts.SourceFile,
  pluginExpressions: string[],
  removePluginCalleeNames?: string[],
):
  | { ok: true; sf: ts.SourceFile; pluginsChanged: boolean }
  | { ok: false; error: string } {
  const factory = ts.factory;
  const configObj = findConfigObject(sf);
  if (!configObj) {
    return {
      ok: false,
      error:
        "Could not find config object (expected `const config = { ... }` or `export default { ... }`).",
    };
  }
  const pluginsProp = getPluginsProperty(configObj, sf);
  if (!pluginsProp) {
    return {
      ok: false,
      error:
        'Could not find `plugins` array on config. Add `plugins: []` to reion.config.ts first.',
    };
  }
  if (!ts.isArrayLiteralExpression(pluginsProp.initializer)) {
    return { ok: false, error: "`plugins` must be an array literal." };
  }
  let arr = pluginsProp.initializer;
  let pluginsPropNode = pluginsProp;

  if (removePluginCalleeNames?.length) {
    const filtered: ts.Expression[] = [];
    let removedAny = false;
    const patterns = removePluginCalleeNames.map((name) => new RegExp(`^${escapeRegExp(name)}\\s*\\(`));
    for (const el of arr.elements) {
      const text = el.getText(sf).trim();
      if (patterns.some((re) => re.test(text))) {
        removedAny = true;
        continue;
      }
      filtered.push(el);
    }
    if (removedAny) {
      const newArr = factory.updateArrayLiteralExpression(arr, factory.createNodeArray(filtered));
      const newConfig = factory.updateObjectLiteralExpression(
        configObj,
        configObj.properties.map((p) =>
          p === pluginsPropNode
            ? factory.updatePropertyAssignment(pluginsPropNode, pluginsPropNode.name, newArr)
            : p,
        ),
      );
      const newSf = replaceNodeInSourceFile(sf, configObj, newConfig);
      const newConfigObj = findConfigObject(newSf);
      if (!newConfigObj) return { ok: false, error: "Internal error: lost config object after edit." };
      const newPluginsProp = getPluginsProperty(newConfigObj, newSf);
      if (!newPluginsProp || !ts.isArrayLiteralExpression(newPluginsProp.initializer)) {
        return { ok: false, error: "Internal error: lost plugins array after edit." };
      }
      return applyPluginExpressionsInner(
        newSf,
        newConfigObj,
        newPluginsProp,
        newPluginsProp.initializer,
        pluginExpressions,
        true,
      );
    }
  }

  return applyPluginExpressionsInner(sf, configObj, pluginsPropNode, arr, pluginExpressions, false);
}

function applyPluginExpressionsInner(
  sf: ts.SourceFile,
  configObj: ts.ObjectLiteralExpression,
  pluginsProp: ts.PropertyAssignment,
  arr: ts.ArrayLiteralExpression,
  pluginExpressions: string[],
  pluginsArrayAlreadyEdited: boolean,
):
  | { ok: true; sf: ts.SourceFile; pluginsChanged: boolean }
  | { ok: false; error: string } {
  const factory = ts.factory;
  /** Collapse `Foo()`, `Foo({})`, `Foo(  )` so setup does not duplicate the same plugin. */
  function pluginDedupeKey(text: string): string {
    const t = text.trim().replace(/\s+/g, "");
    const m = t.match(/^([A-Za-z0-9_$]+)\((.*)\)$/);
    if (!m) return t;
    const [, callee, inner] = m;
    const empty = inner === "" || inner === "{}" || inner === "({})";
    return empty ? `${callee}()` : t;
  }
  const existingKeys = new Set(arr.elements.map((e) => pluginDedupeKey(e.getText(sf))));
  const newExprs: ts.Expression[] = [];
  for (const expr of pluginExpressions) {
    const t = expr.trim();
    if (existingKeys.has(pluginDedupeKey(t))) continue;
    try {
      newExprs.push(parseExpression(t, sf.languageVersion));
      existingKeys.add(pluginDedupeKey(t));
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  if (newExprs.length === 0) {
    return { ok: true, sf, pluginsChanged: pluginsArrayAlreadyEdited };
  }
  const newArr = factory.updateArrayLiteralExpression(
    arr,
    factory.createNodeArray([...arr.elements, ...newExprs]),
  );
  const newConfig = factory.updateObjectLiteralExpression(
    configObj,
    configObj.properties.map((p) =>
      p === pluginsProp ? factory.updatePropertyAssignment(pluginsProp, pluginsProp.name, newArr) : p,
    ),
  );
  return {
    ok: true,
    sf: replaceNodeInSourceFile(sf, configObj, newConfig),
    pluginsChanged: true,
  };
}

/**
 * Updates `reion.config.ts`: merges imports and appends plugin call expressions to `plugins`.
 * Intended for use from plugin setup scripts (see {@link ReionPluginSetupContext}).
 */
export async function addPluginToReionConfig(
  cwd: string,
  input: AddPluginToReionConfigInput,
): Promise<AddPluginToReionConfigResult> {
  const fileName = input.configFile ?? "reion.config.ts";
  if (!fileName.endsWith(".ts")) {
    return {
      ok: false,
      error: `Only TypeScript config is supported for auto-edit (got "${fileName}").`,
    };
  }
  const configPath = resolve(cwd, fileName);
  if (!existsSync(configPath)) {
    return { ok: false, error: `Config file not found: ${configPath}` };
  }
  const text = readFileSync(configPath, "utf8");
  const sf = ts.createSourceFile(configPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const pluginsResult = applyPluginExpressions(
    sf,
    input.pluginExpressions,
    input.removePluginCalleeNames,
  );
  if (!pluginsResult.ok) return pluginsResult;

  const { sf: mergedSf, changed: importsChanged } = mergeImports(
    pluginsResult.sf,
    input.imports ?? [],
  );
  if (!pluginsResult.pluginsChanged && !importsChanged) {
    return { ok: true, configPath, unchanged: true };
  }
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });
  writeFileSync(configPath, printer.printFile(mergedSf), "utf8");
  return { ok: true, configPath, unchanged: false };
}
