
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

  const blankCount = Math.max(0, 28 - opts.items.length - 1);
  const blankRows = Array.from({ length: blankCount }, () =>
    '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>거래명세표 - ${opts.company}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Gulim', '굴림', 'Malgun Gothic', sans-serif; font-size: 12px; color: #000; padding: 24px 28px; }
  .top { position: relative; height: 46px; margin-bottom: 4px; }
  .datebox { position: absolute; left: 0; top: 12px; border: 1px solid #000; display: flex; }
  .datebox .lbl { padding: 4px 8px; border-right: 1px solid #000; font-weight: bold; letter-spacing: 4px; }
  .datebox .val { padding: 4px 12px; min-width: 120px; }
  .title { position: absolute; left: 50%; transform: translateX(-50%); top: 0; border: 3px double #000; padding: 6px 34px; font-size: 22px; font-weight: bold; letter-spacing: 10px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; padding: 3px 5px; font-size: 12px; }
  .head2 td { padding: 0; border: none; }
  .side { width: 18px; text-align: center; font-weight: bold; line-height: 1.3; padding: 2px; }
  .flabel { width: 52px; text-align: center; background: #fff; font-size: 11px; white-space: nowrap; }
  .fval { font-size: 12px; }
  .items th { text-align: center; font-weight: bold; letter-spacing: 1px; padding: 4px 2px; }
  .items td { height: 19px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .totals td { font-weight: bold; height: 24px; }
  .yb { text-align: left; font-weight: bold; letter-spacing: 2px; }
  @media print { body { padding: 10mm 12mm; } }
</style>
</head>
<body>
  <div class="top">
    <div class="datebox"><span class="lbl">일 자</span><span class="val">${dateFull}</span></div>
    <div class="title">거 래 명 세 표</div>
  </div>

  <table class="head2">
    <tr>
      <td style="width:50%; padding:0; border:1px solid #000;">
        <table style="height:100%;">
          <tr>
            <td class="side" rowspan="4">공<br>급<br>자</td>
            <td class="flabel">등록<br>번호</td>
            <td class="fval" colspan="3" style="font-size:15px; font-weight:bold; letter-spacing:1px;">213-87-03002</td>
          </tr>
          <tr>
            <td class="flabel">상호</td>
            <td class="fval" style="width:38%;">(주)비타민사인</td>
            <td class="flabel">성명</td>
            <td class="fval">박혜경</td>
          </tr>
          <tr>
            <td class="flabel">주소</td>
            <td class="fval" colspan="3">경기도 고양시 일산동구 동국로 56(식사동)</td>
          </tr>
          <tr>
            <td class="flabel">업태</td>
            <td class="fval">제조업,서비스</td>
            <td class="flabel">종목</td>
            <td class="fval">현수막,옥내외광고물,광고디자인</td>
          </tr>
        </table>
      </td>
      <td style="width:50%; padding:0; border:1px solid #000;">
        <table style="height:100%;">
          <tr>
            <td class="side" rowspan="4">공<br>급<br>받<br>는<br>자</td>
            <td class="flabel">등록<br>번호</td>
            <td class="fval" colspan="3" style="font-size:15px; font-weight:bold; letter-spacing:1px;">&nbsp;</td>
          </tr>
          <tr>
            <td class="flabel">상호</td>
            <td class="fval" style="width:38%;">${opts.company}</td>
            <td class="flabel">성명</td>
            <td class="fval">&nbsp;</td>
          </tr>
          <tr>
            <td class="flabel">주소</td>
            <td class="fval" colspan="3">&nbsp;</td>
          </tr>
          <tr>
            <td class="flabel">업태</td>
            <td class="fval">&nbsp;</td>
            <td class="flabel">종목</td>
            <td class="fval">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="items" style="margin-top:-1px;">
    <tr>
      <th style="width:56px;">코드/일자</th>
      <th>품 목 / 규 격</th>
      <th style="width:36px;">단위</th>
      <th style="width:46px;">수 량</th>
      <th style="width:78px;">단 가</th>
      <th style="width:88px;">금 액</th>
      <th style="width:70px;">세 액</th>
    </tr>
    ${itemRows}
    <tr><td class="c"></td><td class="yb">※※이 하 여 백※※</td><td></td><td></td><td></td><td></td><td></td></tr>
    ${blankRows}
    <tr class="totals">
      <td class="c" style="letter-spacing:0;">공급<br>가액</td>
      <td class="r" style="width:auto;">${won(opts.supply)}</td>
      <td class="c" colspan="2">세액</td>
      <td class="r">${won(opts.vat)}</td>
      <td class="c">합계&nbsp;&nbsp;<b>${won(opts.total)}</b></td>
      <td class="c">인수자</td>
    </tr>
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