export type SphereGeometry = Readonly<{
  vertices: Float32Array;
  indices: Uint16Array;
}>;

export function createSourceSphereGeometry(): SphereGeometry {
  const t = (1 + Math.sqrt(5)) / 2;
  const originals: readonly (readonly [number, number, number])[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const vertices = originals.map(([x, y, z]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  });
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const midpointCache = new Map<string, number>();
  const midpoint = (a: number, b: number) => {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;
    const va = vertices[a];
    const vb = vertices[b];
    const x = (va[0] + vb[0]) / 2;
    const y = (va[1] + vb[1]) / 2;
    const z = (va[2] + vb[2]) / 2;
    const length = Math.hypot(x, y, z);
    const index = vertices.length;
    vertices.push([x / length, y / length, z / length]);
    midpointCache.set(key, index);
    return index;
  };
  const indices: number[] = [];
  // The source asks for three iterations, but its nested `var i` causes only
  // one effective subdivision: 80 triangles. Preserve that cost and look.
  for (const [a, b, c] of faces) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    indices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  return { vertices: new Float32Array(vertices.flat()), indices: new Uint16Array(indices) };
}
