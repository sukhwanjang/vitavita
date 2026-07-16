
// ── 액자 틀 재단 인쇄 (재단도 + 전개도) ──
export interface FramePrintFrame {
  width: number;
  height: number;
  supports: number;
  horizLen: number;
  vertLen: number;
  supportLen: number;
  qty?: number; // 같은 사이즈 개수
}
export interface FramePrintStock {
  cuts: { len: number; kind: string }[];
  leftover: number;
}

const mmTxt = (n: number) =>
  (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString('ko-KR');

// 전개도 SVG — 액자 한 개의 목재 배치도
const frameSvg = (f: FramePrintFrame): string => {
  const W = 300;
  const scale = W / f.width;
  const H = Math.max(90, Math.min(360, f.height * scale));
  const sc = H / f.height; // 실제 표시 스케일 (세로 기준으로 맞춤)
  const w = f.width * sc;
  const th = Math.max(9, Math.min(22, 27.5 * sc)); // 목재 두께 시각화
  const pad = 44; // 치수선 여백
  const svgW = w + pad * 2;
  const svgH = H + pad * 2;

  // 지지대 위치 (내부 균등 배치)
  const braces = [];
  for (let i = 1; i <= f.supports; i++) {
    const x = pad + (w * i) / (f.supports + 1);
    braces.push(
      `<rect x="${x - th / 2}" y="${pad + th}" width="${th}" height="${H - th * 2}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`
    );
  }

  return `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
    <!-- 프레임 사각 (가로목 위아래 + 세로목 좌우) -->
    <rect x="${pad}" y="${pad}" width="${w}" height="${th}" fill="#94a3b8" stroke="#334155" stroke-width="1"/>
    <rect x="${pad}" y="${pad + H - th}" width="${w}" height="${th}" fill="#94a3b8" stroke="#334155" stroke-width="1"/>
    <rect x="${pad}" y="${pad + th}" width="${th}" height="${H - th * 2}" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>
    <rect x="${pad + w - th}" y="${pad + th}" width="${th}" height="${H - th * 2}" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>
    ${braces.join('')}
    <!-- 상단 가로 치수 -->
    <text x="${pad + w / 2}" y="${pad - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#111">가로 ${mmTxt(f.horizLen)} <tspan fill="#2563eb">×2</tspan></text>
    <line x1="${pad}" y1="${pad - 8}" x2="${pad + w}" y2="${pad - 8}" stroke="#111" stroke-width="0.8"/>
    <!-- 좌측 세로 치수 -->
    <text x="14" y="${pad + H / 2}" text-anchor="middle" font-size="13" font-weight="700" fill="#111" transform="rotate(-90 14 ${pad + H / 2})">세로 ${mmTxt(f.vertLen)} <tspan fill="#2563eb">×2</tspan></text>
    ${f.supports > 0
      ? `<text x="${pad + w / 2}" y="${pad + H + 22}" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">지지대 ${mmTxt(f.supportLen)} ×${f.supports}</text>`
      : ''}
  </svg>`;
};

export const handlePrintFrameCut = (opts: {
  title?: string;
  company?: string | null;
  frames: FramePrintFrame[];
  stocks: FramePrintStock[];
  stockLength: number;
  stockCount: number;
  efficiency: number;
  totalLeftover: number;
  woodWidth: number;
  kerf: number;
  date?: Date;
}) => {
  const d = opts.date ?? new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const kindColor: Record<string, string> = {
    가로: '#3b82f6', 세로: '#10b981', 지지대: '#f59e0b',
  };

  // 재단도 — 원장별 막대
  const stockBars = opts.stocks.map((st, i) => {
    const segs = st.cuts.map(c => {
      const pct = (c.len / opts.stockLength) * 100;
      return `<div class="seg" style="width:${pct}%;background:${kindColor[c.kind] ?? '#64748b'}">
        <span>${c.kind}<br>${mmTxt(c.len)}</span>
      </div>`;
    }).join('');
    const leftPct = (st.leftover / opts.stockLength) * 100;
    const leftSeg = st.leftover > 0
      ? `<div class="seg leftover" style="width:${leftPct}%"><span>자투리<br>${mmTxt(st.leftover)}</span></div>`
      : '';
    return `<div class="stockrow">
      <div class="stocklabel">원장 ${i + 1}</div>
      <div class="bar">${segs}${leftSeg}</div>
    </div>`;
  }).join('');

  // 전개도 — 프레임별 (같은 사이즈는 ×N로 한 번만)
  const frameDiagrams = opts.frames.map((f, i) => `
    <div class="frame">
      <div class="frame-title">틀 ${i + 1} · ${mmTxt(f.width)} × ${mmTxt(f.height)}${(f.qty ?? 1) > 1 ? ` <span style="color:#dc2626">×${f.qty}개</span>` : ''}</div>
      ${frameSvg(f)}
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>액자 재단 - ${opts.company || dateStr}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #111; font-size: 13px; }
  h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .head { display: flex; align-items: baseline; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 4px; }
  .head .sub { font-size: 12px; color: #555; }
  .meta { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: #333; margin: 10px 0 16px; }
  .meta b { color: #111; }
  .meta .big { font-size: 15px; font-weight: 800; }
  h2 { font-size: 14px; font-weight: 800; margin: 18px 0 8px; padding-left: 8px; border-left: 4px solid #2563eb; }
  /* 재단도 */
  .stockrow { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .stocklabel { flex: 0 0 54px; font-size: 12px; font-weight: 700; }
  .bar { flex: 1; display: flex; height: 42px; border: 1px solid #111; border-radius: 3px; overflow: hidden; }
  .seg { display: flex; align-items: center; justify-content: center; border-right: 1px solid rgba(255,255,255,.6); color: #fff; font-size: 10px; font-weight: 700; text-align: center; line-height: 1.15; min-width: 0; overflow: hidden; }
  .seg:last-child { border-right: 0; }
  .seg.leftover { background: repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 5px,#d1d5db 5px,#d1d5db 10px); color: #555; }
  /* 전개도 */
  .frames { display: flex; flex-wrap: wrap; gap: 18px; }
  .frame { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px 4px; }
  .frame-title { font-size: 12px; font-weight: 800; margin-bottom: 4px; }
  .legend { display: flex; gap: 14px; font-size: 11px; margin: 4px 0 14px; }
  .legend span { display: inline-flex; align-items: center; gap: 4px; }
  .legend i { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
  .warn { color: #dc2626; font-weight: 700; margin-top: 8px; }
</style>
</head>
<body>
  <div class="head">
    <h1>액자 재단 지시서</h1>
    <span class="sub">${opts.company ? opts.company + ' · ' : ''}${dateStr}</span>
  </div>
  <div class="meta">
    <span>필요 원장 <b class="big">${opts.stockCount}</b>개</span>
    <span>자재 효율 <b class="big">${opts.efficiency}%</b></span>
    <span>총 자투리 <b>${mmTxt(opts.totalLeftover)}</b>mm</span>
    <span>원장 <b>${mmTxt(opts.stockLength)}</b> · 목재폭 <b>${mmTxt(opts.woodWidth)}</b>${opts.kerf ? ` · 톱날 ${mmTxt(opts.kerf)}` : ''}</span>
  </div>

  <div class="legend">
    <span><i style="background:#3b82f6"></i>가로</span>
    <span><i style="background:#10b981"></i>세로</span>
    <span><i style="background:#f59e0b"></i>지지대</span>
    <span><i style="background:#d1d5db"></i>자투리</span>
  </div>

  <h2>재단도 — 원장을 이대로 자르세요</h2>
  ${stockBars}

  <h2>틀 전개도 — 이렇게 조립하세요</h2>
  <div class="frames">${frameDiagrams}</div>

  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

// ── 거래명세표 인쇄 (실제 사용 양식 재현) ──
export interface StatementItem {
  name: string;      // 품명
  spec: string;      // 규격 (가로*세로 등)
  qty: number;       // 수량
  unitPrice: number; // 단가
  amount: number;    // 금액 (공급가)
}

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const won = (n: number) => (n > 0 ? n.toLocaleString('ko-KR') : '');

export const handlePrintStatement = (opts: {
  company: string;
  program?: string | null;
  items: StatementItem[];
  supply: number;
  vat: number;
  total: number;
  date?: Date;
}) => {
  const d = opts.date ?? new Date();
  const dateFull = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}(${DAY_KO[d.getDay()]})`;
  const dateShort = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const prog = (opts.program ?? '').trim();

  const itemRows = opts.items.map(it => `
    <tr>
      <td class="c">${dateShort}</td>
      <td>[${it.name}]${prog}${it.spec ? ' ' + it.spec : ''}</td>
      <td class="c"></td>
      <td class="r">${it.qty}</td>
      <td class="r">${won(it.unitPrice)}</td>
      <td class="r">${won(it.amount)}</td>
      <td class="r">${won(Math.round(it.amount / 10))}</td>
    </tr>`).join('');

  const blankCount = Math.max(0, 26 - opts.items.length - 1);
  const blankRows = Array.from({ length: blankCount }, () =>
    '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>거래명세표 - ${opts.company}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Gulim', '굴림', 'Malgun Gothic', sans-serif; font-size: 12px; color: #000; width: 186mm; margin: 0 auto; padding-top: 4mm; }

  /* 상단: 일자 + 제목 */
  .toprow { display: flex; align-items: center; margin-bottom: 8px; }
  .datebox { flex: 0 0 auto; border-collapse: collapse; }
  .datebox td { border: 1px solid #000; padding: 5px 10px; font-size: 12px; }
  .datebox .lbl { font-weight: bold; letter-spacing: 6px; }
  .datebox .val { min-width: 118px; text-align: center; }
  .title { flex: 1; text-align: center; }
  .title span { display: inline-block; border: 3px double #000; padding: 7px 36px; font-size: 22px; font-weight: bold; letter-spacing: 12px; }
  .topspacer { flex: 0 0 178px; }

  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td { border: 1px solid #000; padding: 3px 5px; font-size: 12px; overflow: hidden; }
  .datebox { width: auto; table-layout: auto; }

  /* 공급자 / 공급받는자 */
  .party { width: 100%; }
  .party > tbody > tr > td { padding: 0; border: 1px solid #000; vertical-align: top; }
  .inner { height: 100%; }
  .inner td { font-size: 11px; height: 22px; }
  .side { width: 20px; text-align: center; font-weight: bold; font-size: 11px; line-height: 1.25; padding: 2px 1px; }
  .fl { width: 40px; text-align: center; font-size: 10px; white-space: nowrap; padding: 2px; }
  .regno { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
  .smtxt { font-size: 10px; }

  /* 품목 */
  .items { margin-top: -1px; }
  .items .hd td { text-align: center; font-weight: bold; letter-spacing: 1px; padding: 5px 2px; }
  .items td { height: 20px; white-space: nowrap; }
  .c { text-align: center; }
  .r { text-align: right; }
  .yb { font-weight: bold; letter-spacing: 2px; }

  /* 합계 */
  .totals { margin-top: -1px; }
  .totals td { height: 26px; font-weight: bold; }
  .totals .lb { text-align: center; font-size: 11px; letter-spacing: 0; }
</style>
</head>
<body>
  <div class="toprow">
    <table class="datebox"><tbody><tr><td class="lbl">일 자</td><td class="val">${dateFull}</td></tr></tbody></table>
    <div class="title"><span>거 래 명 세 표</span></div>
    <div class="topspacer"></div>
  </div>

  <table class="party">
    <tbody>
      <tr>
        <td style="width:50%;">
          <table class="inner">
            <tbody>
              <tr>
                <td class="side" rowspan="4">공<br>급<br>자</td>
                <td class="fl">등록<br>번호</td>
                <td class="regno" colspan="3">213-87-03002</td>
              </tr>
              <tr>
                <td class="fl">상호</td>
                <td style="width:41%;">(주)비타민사인</td>
                <td class="fl">성명</td>
                <td>박혜경</td>
              </tr>
              <tr>
                <td class="fl">주소</td>
                <td colspan="3" class="smtxt">경기도 고양시 일산동구 동국로 58(식사동)</td>
              </tr>
              <tr>
                <td class="fl">업태</td>
                <td class="smtxt">제조업,서비스</td>
                <td class="fl">종목</td>
                <td class="smtxt">현수막,옥내외광고물,광고디자인</td>
              </tr>
            </tbody>
          </table>
        </td>
        <td style="width:50%;">
          <table class="inner">
            <tbody>
              <tr>
                <td class="side" rowspan="4">공급<br>받는<br>자</td>
                <td class="fl">등록<br>번호</td>
                <td class="regno" colspan="3">&nbsp;</td>
              </tr>
              <tr>
                <td class="fl">상호</td>
                <td style="width:41%;">${opts.company}</td>
                <td class="fl">성명</td>
                <td>&nbsp;</td>
              </tr>
              <tr>
                <td class="fl">주소</td>
                <td colspan="3">&nbsp;</td>
              </tr>
              <tr>
                <td class="fl">업태</td>
                <td>&nbsp;</td>
                <td class="fl">종목</td>
                <td>&nbsp;</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>

  <table class="items">
    <colgroup>
      <col style="width:52px;"><col><col style="width:34px;"><col style="width:44px;">
      <col style="width:74px;"><col style="width:84px;"><col style="width:66px;">
    </colgroup>
    <tbody>
      <tr class="hd">
        <td>코드/일자</td>
        <td>품 목 / 규 격</td>
        <td>단위</td>
        <td>수 량</td>
        <td>단 가</td>
        <td>금 액</td>
        <td>세 액</td>
      </tr>
      ${itemRows}
      <tr><td></td><td class="yb">※※이 하 여 백※※</td><td></td><td></td><td></td><td></td><td></td></tr>
      ${blankRows}
    </tbody>
  </table>

  <table class="totals">
    <colgroup>
      <col style="width:52px;"><col><col style="width:44px;"><col style="width:96px;">
      <col style="width:44px;"><col style="width:104px;"><col style="width:52px;"><col style="width:66px;">
    </colgroup>
    <tbody>
      <tr>
        <td class="lb">공급<br>가액</td>
        <td class="r">${won(opts.supply)}</td>
        <td class="lb">세액</td>
        <td class="r">${won(opts.vat)}</td>
        <td class="lb">합계</td>
        <td class="r">${won(opts.total)}</td>
        <td class="lb">인수자</td>
        <td>&nbsp;</td>
      </tr>
    </tbody>
  </table>

  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export const handlePrintImage = (imageUrl: string, company: string, program: string) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    const html = `
      <html>
        <head>
          <title>${company} - ${program} 출력</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              font-family: sans-serif;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .image-container {
              max-width: 100%;
              height: auto;
            }
            img {
              max-width: 100%;
              height: auto;
              object-fit: contain;
            }
            @media print {
              body {
                padding: 0;
              }
              .header {
                margin-bottom: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${company}</h2>
            <p>${program}</p>
          </div>
          <div class="image-container">
            <img src="${imageUrl}" alt="${company} - ${program}" />
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
};
