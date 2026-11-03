// code block formatter; heavy formatters load only when first used

// prettier parser + plugins per code block language
const PRETTIER: Record<string, { parser: string; plugins: () => Promise<unknown[]> }> = {
  javascript: { parser: "babel", plugins: () => Promise.all([import("prettier/plugins/babel"), import("prettier/plugins/estree")]) },
  typescript: { parser: "typescript", plugins: () => Promise.all([import("prettier/plugins/typescript"), import("prettier/plugins/estree")]) },
  css: { parser: "css", plugins: () => Promise.all([import("prettier/plugins/postcss")]) },
  xml: { parser: "html", plugins: () => Promise.all([import("prettier/plugins/html")]) },
  yaml: { parser: "yaml", plugins: () => Promise.all([import("prettier/plugins/yaml")]) },
};

// languages the format button supports
export const FORMATTABLE = new Set(["json", "sql", ...Object.keys(PRETTIER)]);

// format code in the given language; throws a readable message on invalid code
export async function formatCode(lang: string, code: string): Promise<string> {
  // json: native parse + 2-space pretty print
  if (lang === "json") {
    try {
      return JSON.stringify(JSON.parse(code), null, 2);
    } catch (e) {
      throw new Error(`JSON tidak valid: ${(e as Error).message}`);
    }
  }
  // sql: sql-formatter
  if (lang === "sql") {
    const { format } = await import("sql-formatter");
    return format(code, { keywordCase: "upper", tabWidth: 2 });
  }
  // the rest: prettier standalone
  const p = PRETTIER[lang];
  if (!p) throw new Error("Bahasa ini belum bisa di-format");
  const [{ format }, plugins] = await Promise.all([import("prettier/standalone"), p.plugins()]);
  try {
    const out = await format(code, { parser: p.parser, plugins: plugins as never, tabWidth: 2, printWidth: 80 });
    return out.replace(/\n$/, "");
  } catch (e) {
    // prettier messages carry a code frame; keep the first line only
    throw new Error(`Kode tidak valid: ${(e as Error).message.split("\n")[0]}`);
  }
}
