// 단가표 — X:\작업파일\단가 계산기.xlsx 의 '단가표' 시트 기준 (2026-07 반영)
// perUnit: true = 개당 가격 (수량 × 단가), false = ㎡당 가격 (가로 × 세로 × 단가)

export interface PriceItem {
  category: string;
  name: string;
  price: number;
  perUnit: boolean;
  note?: string;
}

export const PRICE_ITEMS: PriceItem[] = [
  // 유포
  { category: '유포', name: '유포 출력', price: 22000, perUnit: false },
  { category: '유포', name: '유포 컷팅', price: 27000, perUnit: false },
  { category: '유포', name: '유포+자석', price: 38000, perUnit: false },
  { category: '유포', name: '유포1T', price: 40000, perUnit: false, note: '포맥스/폼보드' },
  { category: '유포', name: '유포2T', price: 44000, perUnit: false },
  { category: '유포', name: '유포3T', price: 50000, perUnit: false },
  { category: '유포', name: '유포5T', price: 55000, perUnit: false },
  // 출력
  { category: '출력', name: '켈지', price: 28000, perUnit: false },
  { category: '출력', name: '켈지그레이(켈G)', price: 28000, perUnit: false },
  { category: '출력', name: '모조지', price: 18000, perUnit: false },
  { category: '출력', name: '인화지', price: 22000, perUnit: false },
  // 현수막
  { category: '현수막', name: '현수막(재단)', price: 7000, perUnit: false },
  { category: '현수막', name: '현수막(배너)', price: 15000, perUnit: true },
  { category: '현수막', name: '솔벤현수막(단폭)', price: 10000, perUnit: false, note: '~1800' },
  { category: '현수막', name: '솔벤현수막(장폭)', price: 12000, perUnit: false, note: '2000~' },
  { category: '현수막', name: '텐트천', price: 10000, perUnit: false },
  // 페트배너
  { category: '페트배너', name: '페트', price: 30000, perUnit: false },
  { category: '페트배너', name: '페트배너(x자배너)', price: 25000, perUnit: true },
  { category: '페트배너', name: '페트배너(단면 기본)', price: 35000, perUnit: true, note: '다보(4개=1set) 10,000' },
  { category: '페트배너', name: '페트배너(단면 세트)', price: 65000, perUnit: true },
  { category: '페트배너', name: '페트배너(양면 기본)', price: 40000, perUnit: true },
  { category: '페트배너', name: '페트배너(양면 세트)', price: 100000, perUnit: true },
  // 미니배너
  { category: '미니배너', name: '미니배너 화면', price: 3000, perUnit: false },
  { category: '미니배너', name: '미니배너 거치대', price: 2500, perUnit: false },
  // 어깨띠
  { category: '어깨띠', name: '어깨띠1', price: 8000, perUnit: true },
  { category: '어깨띠', name: '어깨띠2', price: 6000, perUnit: false, note: '10장 이상' },
  // 번호판
  { category: '번호판', name: '일반 번호판', price: 8000, perUnit: true, note: '타공 5mm, 모서리에서 15mm' },
  { category: '번호판', name: '오토바이 번호판', price: 5000, perUnit: true },
  { category: '번호판', name: '포멕스 스카시 번호판', price: 35000, perUnit: true },
  { category: '번호판', name: '철판 스카시 번호판', price: 40000, perUnit: true },
  // 포멕스
  { category: '포멕스', name: '포맥스1T_1', price: 10000, perUnit: false, note: '3*6' },
  { category: '포멕스', name: '포맥스2T_1', price: 15000, perUnit: false, note: '3*6' },
  { category: '포멕스', name: '포맥스3T_1', price: 20000, perUnit: false, note: '3*6' },
  { category: '포멕스', name: '포맥스5T_1', price: 35000, perUnit: false, note: '3*6' },
  { category: '포멕스', name: '포맥스1T_2', price: 20000, perUnit: false, note: '4*8' },
  { category: '포멕스', name: '포맥스2T_2', price: 25000, perUnit: false, note: '4*8' },
  { category: '포멕스', name: '포맥스3T_2', price: 40000, perUnit: false, note: '4*8' },
  { category: '포멕스', name: '포맥스5T_2', price: 60000, perUnit: false, note: '4*8' },
  // 기타
  { category: '기타', name: '투명(3레이어)', price: 40000, perUnit: false },
  { category: '기타', name: '투명시트', price: 30000, perUnit: false, note: '정면 40,000원' },
  { category: '기타', name: '백릿', price: 30000, perUnit: false },
  { category: '기타', name: '리무버블', price: 23000, perUnit: false },
  { category: '기타', name: '캔버스', price: 45000, perUnit: false },
  { category: '기타', name: '캔버스액자제작', price: 120000, perUnit: false },
  { category: '기타', name: '수성와이드', price: 30000, perUnit: false },
  { category: '기타', name: '솔벤와이드', price: 30000, perUnit: false },
  { category: '기타', name: '등신대', price: 110000, perUnit: true, note: '600*1800' },
  { category: '기타', name: '주소판', price: 4000, perUnit: true, note: '일반사이즈' },
  { category: '기타', name: '유포 포스터(500*700)', price: 7000, perUnit: true },
  { category: '기타', name: '유포 포스터(600*900)', price: 10000, perUnit: true },
  { category: '기타', name: '명패 컷팅', price: 3000, perUnit: true },
  { category: '기타', name: '투명+카드', price: 5000, perUnit: true },
  { category: '기타', name: 'A4명함', price: 5000, perUnit: true, note: '10장' },
  { category: '기타', name: '신문(단면)', price: 15000, perUnit: false },
  { category: '기타', name: '신문(양면)', price: 30000, perUnit: false },
  { category: '기타', name: '보조시트', price: 3000, perUnit: false },
];
