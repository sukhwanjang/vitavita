
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
                <td colspan="3" class="smtxt">경기도 고양시 일산동구 동국로 56(식사동)</td>
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
