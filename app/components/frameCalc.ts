// 액자 틀 재단 계산 — X:\...\액자 틀 제작v2.exe 의 로직 재현 + 여러 액자 통합 재단
//
// 프레임 구조: 가로목 2개가 바깥 폭(width)을 이루고, 세로목·지지대는
// 위아래 가로목 두께(woodWidth)만큼 짧아져 그 사이에 끼워진다.
//   가로목 길이 = width
//   세로목 길이 = height - 2*woodWidth
//   지지대 길이 = 세로목과 동일 (세로 방향 보강)

export interface FrameSpec {
  id: number;
  width: number;    // 가로 (mm)
  height: number;   // 세로 (mm)
  supports: number; // 지지대 개수
  qty: number;      // 같은 사이즈 개수
}

export interface FrameSettings {
  woodWidth: number;   // 목재 폭 (mm)
  stockLength: number; // 원장 길이 (mm)
  kerf: number;        // 톱날 여유 (mm)
}

export const DEFAULT_SETTINGS: FrameSettings = {
  woodWidth: 27.5,
  stockLength: 3630,
  kerf: 0,
};

export type PieceKind = '가로' | '세로' | '지지대';

export interface Piece {
  len: number;
  kind: PieceKind;
  frameId: number;
}

export interface FramePieces {
  horizLen: number;
  vertLen: number;
  supportLen: number;
  supportQty: number;
}

export function framePieces(spec: FrameSpec, s: FrameSettings): FramePieces {
  const vertLen = Math.round((spec.height - 2 * s.woodWidth) * 10) / 10;
  return {
    horizLen: spec.width,
    vertLen,
    supportLen: vertLen,
    supportQty: Math.max(0, spec.supports),
  };
}

// 한 프레임의 모든 조각(가로2 + 세로2 + 지지대N) × 수량
export function pieceList(spec: FrameSpec, s: FrameSettings): Piece[] {
  const p = framePieces(spec, s);
  const qty = Math.max(1, spec.qty || 1);
  const out: Piece[] = [];
  for (let q = 0; q < qty; q++) {
    out.push(
      { len: p.horizLen, kind: '가로', frameId: spec.id },
      { len: p.horizLen, kind: '가로', frameId: spec.id },
      { len: p.vertLen, kind: '세로', frameId: spec.id },
      { len: p.vertLen, kind: '세로', frameId: spec.id },
    );
    for (let i = 0; i < p.supportQty; i++) {
      out.push({ len: p.supportLen, kind: '지지대', frameId: spec.id });
    }
  }
  return out;
}

export interface Stock {
  cuts: Piece[];
  used: number;    // 실제 점유 길이 (톱날 여유 포함)
  rawUsed: number; // 조각 길이 합 (톱날 여유 제외)
  leftover: number; // 남는 자투리
}

export interface CutResult {
  stocks: Stock[];
  stockCount: number;
  efficiency: number;  // %
  totalLeftover: number;
  totalRaw: number;
  oversized: Piece[];  // 원장보다 긴 조각 (재단 불가)
}

// 원장 최적 재단 — First Fit Decreasing (긴 조각부터 채우기)
export function optimize(pieces: Piece[], s: FrameSettings): CutResult {
  const oversized: Piece[] = [];
  const fit = pieces.filter(p => {
    if (p.len > s.stockLength) { oversized.push(p); return false; }
    return true;
  });

  const sorted = [...fit].sort((a, b) => b.len - a.len);
  const stocks: Stock[] = [];

  for (const p of sorted) {
    let placed = false;
    for (const st of stocks) {
      const need = p.len + (st.cuts.length > 0 ? s.kerf : 0);
      if (st.used + need <= s.stockLength) {
        st.cuts.push(p);
        st.used += need;
        st.rawUsed += p.len;
        placed = true;
        break;
      }
    }
    if (!placed) {
      stocks.push({ cuts: [p], used: p.len, rawUsed: p.len, leftover: 0 });
    }
  }

  stocks.forEach(st => { st.leftover = Math.round((s.stockLength - st.used) * 10) / 10; });

  const stockCount = stocks.length;
  const totalRaw = stocks.reduce((sum, st) => sum + st.rawUsed, 0);
  const capacity = s.stockLength * stockCount;
  const efficiency = capacity > 0 ? Math.round((totalRaw / capacity) * 1000) / 10 : 0;
  const totalLeftover = stocks.reduce((sum, st) => sum + st.leftover, 0);

  return {
    stocks,
    stockCount,
    efficiency,
    totalLeftover: Math.round(totalLeftover * 10) / 10,
    totalRaw: Math.round(totalRaw * 10) / 10,
    oversized,
  };
}

export const fmtMm = (n: number) =>
  (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString('ko-KR');
