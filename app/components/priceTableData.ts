// 단가표(참고용 전체 표) — X:\작업파일\단가 계산기.xlsx '단가표' 시트 그대로
// 계산기 자동완성 목록(priceData.ts)과 별개로, 조회용 전체 표입니다.

export interface RefRow {
  name: string;
  spec?: string;   // 규격 (1 = 개당)
  price: number;
  note?: string;   // 비고
}

export interface RefGroup {
  category: string;
  rows: RefRow[];
}

export const FULL_PRICE_TABLE: RefGroup[] = [
  {
    category: '유포',
    rows: [
      { name: '유포 출력', price: 22000 },
      { name: '유포 컷팅', price: 27000 },
      { name: '유포G', price: 27000 },
      { name: '유포+자석', price: 38000 },
      { name: '유포1T', price: 40000, note: '포맥스/폼포드' },
      { name: '유포2T', price: 44000 },
      { name: '유포3T', price: 50000 },
      { name: '유포5T', price: 55000 },
    ],
  },
  {
    category: '출력',
    rows: [
      { name: '켈지', price: 28000 },
      { name: '켈지그레이(켈G)', price: 28000 },
      { name: '모조지', price: 18000 },
      { name: '인화지', price: 22000 },
    ],
  },
  {
    category: '현수막',
    rows: [
      { name: '현수막(재단)', price: 7000 },
      { name: '현수막(배너)', spec: '1', price: 15000, note: '개당' },
      { name: '솔벤현수막(단폭)', price: 10000, note: '~1800' },
      { name: '솔벤현수막(장폭)', price: 12000, note: '2000~' },
      { name: '텐트천', price: 10000 },
    ],
  },
  {
    category: '페트배너',
    rows: [
      { name: '페트', price: 30000, note: '개당' },
      { name: '페트배너(x자배너)', spec: '1', price: 25000, note: '개당' },
      { name: '페트배너(단면 기본)', spec: '1', price: 35000, note: '개당' },
      { name: '페트배너(단면 세트)', spec: '1', price: 65000, note: '개당' },
      { name: '페트배너(양면 기본)', spec: '1', price: 40000, note: '개당' },
      { name: '페트배너(양면 세트)', spec: '1', price: 100000, note: '개당' },
    ],
  },
  {
    category: '미니배너',
    rows: [
      { name: '미니배너 화면', price: 3000 },
      { name: '미니배너 거치대', price: 2500 },
    ],
  },
  {
    category: '어깨띠',
    rows: [
      { name: '어깨띠1', spec: '1', price: 8000, note: '개당' },
      { name: '어깨띠2', price: 6000, note: '10장 이상' },
    ],
  },
  {
    category: '번호판',
    rows: [
      { name: '일반 번호판', spec: '1', price: 8000, note: '개당' },
      { name: '오토바이 번호판', spec: '1', price: 5000, note: '개당' },
      { name: '포멕스 스카시 번호판', spec: '1', price: 35000, note: '개당' },
      { name: '철판 스카시 번호판', spec: '1', price: 40000, note: '개당' },
    ],
  },
  {
    category: '포멕스',
    rows: [
      { name: '포맥스1T_1', price: 10000, note: '3*6' },
      { name: '포맥스2T_1', price: 15000, note: '3*6' },
      { name: '포맥스3T_1', price: 20000, note: '3*6' },
      { name: '포맥스5T_1', price: 35000, note: '3*6' },
      { name: '포맥스1T_2', price: 20000, note: '4*8' },
      { name: '포맥스2T_2', price: 25000, note: '4*8' },
      { name: '포맥스3T_2', price: 40000, note: '4*8' },
      { name: '포맥스5T_2', price: 60000, note: '4*8' },
    ],
  },
  {
    category: '기타',
    rows: [
      { name: '모조지', price: 18000 },
      { name: '투명(3레이어)', price: 40000 },
      { name: '투명시트', price: 30000, note: '40장 / 정면 40,000원' },
      { name: '백릿', price: 30000 },
      { name: '리무버블', price: 23000 },
      { name: '캔버스', price: 45000 },
      { name: '캔버스액자제작', price: 120000 },
      { name: '수성와이드', price: 30000 },
      { name: '솔벤와이드', price: 30000 },
      { name: '등신대', price: 110000, note: '600*1800' },
      { name: '주소판', price: 4000, note: '일반사이즈' },
      { name: '유포 포스터', price: 7000, note: '500*700' },
      { name: '유포 포스터', price: 10000, note: '600*900' },
      { name: '명패 컷팅', price: 3000 },
      { name: '투명+카드', price: 5000 },
      { name: 'A4명함', price: 5000, note: '10장' },
      { name: '신문(단면)', price: 15000 },
      { name: '신문(양면)', price: 30000 },
      { name: '보조시트', price: 3000 },
    ],
  },
];

// 옆에 적어두는 참고 시세/작업 메모
export interface RefNote {
  title: string;
  lines: string[];
}

export const REF_NOTES: RefNote[] = [
  {
    title: '유포 규격가',
    lines: [
      '594×420 : 5,500',
      '500×700 : 8,000',
      '600×900 : 12,000',
      '유포+자석 600 : 35,000 / 1000 : 60,000',
      '시트컷팅 골드헤어라인 : 12,000',
    ],
  },
  {
    title: '아트지 / 스노우지',
    lines: [
      '100G 양면 — A4 3,000 · A3 4,000',
      '100G 단면 — A4 2,000 · A3 3,000',
      '250G 양면 — A4 4,000 · A3 5,000',
      '250G 단면 — A4 3,000 · A3 4,000',
      '명함(10장 기준) : 5,000',
    ],
  },
  {
    title: '페트배너 참고',
    lines: [
      '다보제작 시 앞 5T(투명) 뒤 3T(투명 or 백색)',
      '앞판: 투명아크릴 5T / 뒷판: 투명 3T',
      '다보(4개=1set) 10,000',
      '투명으로 작업 시 50mm 여분 주고 사방 25mm 안쪽으로 뚫기(구멍)',
      '20번 누르고 엔터 / 엔드는 엔터',
    ],
  },
  {
    title: '스카시 / 기타 참고',
    lines: [
      '스카시10T — 100mm당 10,000원 (복잡하면 +@)',
      '고무스카시 20T — 큰 건 6~7만원 · 작은 건 2~3만원',
      '고무스카시 작은 건 글자당 2,500원',
      '번호판 타공 5mm, 모서리에서 15mm 띄기',
      '아크릴명찰 6,000원',
      '미러천 깃발여분 30mm',
      '캔버스액자 여분 50mm 이상',
    ],
  },
];
