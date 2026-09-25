export type ParticleAllocation = Readonly<{
  profile: "standard" | "compact";
  grid: readonly [number, number, number];
  particleCount: number;
  particles: Readonly<{ width: number; height: number }>;
  output: Readonly<{ width: number; height: number }>;
  shadow: Readonly<{ width: number; height: number }>;
  sphereRadius: number;
  attachmentBytes: number;
  textureBytes: number;
  bytes: number;
}>;

export function planParticleAllocation(
  viewport: Readonly<{ pixelWidth: number; pixelHeight: number }>,
  limits: Readonly<{ maxTextureSize: number; maxRenderTargetBytes: number }>,
  quality: "economy" | "balanced" | "detail" = "detail",
): ParticleAllocation | null {
  const { pixelWidth, pixelHeight } = viewport;
  const { maxTextureSize, maxRenderTargetBytes } = limits;
  if (![pixelWidth, pixelHeight, maxTextureSize, maxRenderTargetBytes].every(Number.isFinite)
    || pixelWidth < 1 || pixelHeight < 1 || maxTextureSize < 325 || maxRenderTargetBytes < 1) return null;

  const standard = quality !== "economy" && maxRenderTargetBytes >= 16 * 1024 * 1024 && maxTextureSize >= 1024;
  const profile = standard ? "standard" : "compact";
  const grid: readonly [number, number, number] = standard ? [32, 16, 16] : [24, 12, 12];
  const particles = standard ? { width: 256, height: 120 } : { width: 192, height: 68 };
  const particleCount = particles.width * particles.height;
  const shadow = { width: 256, height: 256 };
  const velocityCells = (grid[0] + 1) * (grid[1] + 1) * (grid[2] + 1);
  const scalarCells = grid[0] * grid[1] * grid[2];
  // Source field: two RGBA32F position textures, two RGBA16F velocity
  // textures, one RGBA32F random field, four RGBA16F MAC velocity fields,
  // three RGBA16F scalar fields and one RGBA8 occupancy field.
  const solverBytes = particleCount * (16 * 3 + 8 * 2)
    + velocityCells * 8 * 4 + scalarCells * (8 * 3 + 4);
  // RGBA16F normal/speed/depth, RGBA8 AO/composite/output, D16 depth.
  const renderBytesPerPixel = 8 + 4 + 4 + 4 + 2;
  const fixedBytes = solverBytes + shadow.width * shadow.height * 2;
  const maxPixelsByBudget = Math.floor((maxRenderTargetBytes - fixedBytes) / renderBytesPerPixel);
  if (maxPixelsByBudget < 192 * 192) return null;
  const maxLongEdge = Math.min(maxTextureSize, standard ? (quality === "balanced" ? 800 : 960) : 640);
  const firstScale = Math.min(1, maxLongEdge / Math.max(pixelWidth, pixelHeight));
  const firstWidth = Math.max(1, Math.floor(pixelWidth * firstScale));
  const firstHeight = Math.max(1, Math.floor(pixelHeight * firstScale));
  const budgetScale = Math.min(1, Math.sqrt(maxPixelsByBudget / (firstWidth * firstHeight)));
  const output = {
    width: Math.max(1, Math.floor(firstWidth * budgetScale)),
    height: Math.max(1, Math.floor(firstHeight * budgetScale)),
  };
  if (Math.min(output.width, output.height) < 192) return null;
  const bytes = fixedBytes + output.width * output.height * renderBytesPerPixel;
  if (bytes > maxRenderTargetBytes) return null;
  const textureBytes = particleCount * 16; // sampled-only random direction texture
  return { profile, grid, particleCount, particles, output, shadow,
    sphereRadius: 7 / grid[0], attachmentBytes: bytes - textureBytes, textureBytes, bytes };
}
