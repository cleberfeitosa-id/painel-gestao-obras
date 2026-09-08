export function calcularMatrizTransformacao(
  baseP1: { x: number; y: number },
  baseP2: { x: number; y: number },
  targetP1: { x: number; y: number },
  targetP2: { x: number; y: number }
) {
  const bx = baseP2.x - baseP1.x;
  const by = baseP2.y - baseP1.y;
  const tx = targetP2.x - targetP1.x;
  const ty = targetP2.y - targetP1.y;

  const b_len = Math.sqrt(bx * bx + by * by);
  const t_len = Math.sqrt(tx * tx + ty * ty);

  // Se o comprimento for 0 (pontos iguais), retorna matriz identidade
  if (t_len === 0 || b_len === 0) {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  const scale = b_len / t_len;
  const b_angle = Math.atan2(by, bx);
  const t_angle = Math.atan2(ty, tx);
  const angle = b_angle - t_angle;

  const a = scale * Math.cos(angle);
  const b = scale * Math.sin(angle);
  const c = -scale * Math.sin(angle);
  const d = scale * Math.cos(angle);

  const e = baseP1.x - (a * targetP1.x + c * targetP1.y);
  const f = baseP1.y - (b * targetP1.x + d * targetP1.y);

  return { a, b, c, d, e, f };
}
