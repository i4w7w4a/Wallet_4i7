import { MONO_FONT_REGISTRY, MONO_FONT_SPECIMEN, normalizeMonoFontWeight } from "./mono-font-registry";
import { MONO_TYPOGRAPHY_ROLES, normalizeMonoTypography, validateMonoTypography, type MonoTypographyConfigV1 } from "./mono-typography";

/** The caller commits the returned config, never the pending request. */
export async function loadMonoTypography(input: unknown, fonts?: Pick<FontFaceSet, "load">): Promise<MonoTypographyConfigV1> {
  if (!validateMonoTypography(input)) throw new Error("Недопустимый шрифтовой набор");
  const config = normalizeMonoTypography(input);
  const port = fonts ?? (typeof document !== "undefined" ? document.fonts : undefined);
  if (!port?.load) throw new Error("Загрузка шрифтов недоступна");
  const requests = new Set<string>();
  for (const id of [config.primaryFontId, config.secondaryFontId]) {
    for (const role of MONO_TYPOGRAPHY_ROLES) {
      // Load the companion's real weight as well: it owns any missing symbols.
      const weight = normalizeMonoFontWeight(id, config.roles[role].weight);
      requests.add(`${weight} 16px "${MONO_FONT_REGISTRY[id].family}"`);
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([...requests].map(async request => {
        const faces = await port.load(request, MONO_FONT_SPECIMEN);
        if (!faces.length) throw new Error("Не удалось загрузить выбранное начертание");
      })),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Истекло время загрузки шрифтов")), 8000); }),
    ]);
  } finally { clearTimeout(timer); }
  return config;
}
