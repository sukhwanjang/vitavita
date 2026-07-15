// 단가표 — X:\작업파일\단가 계산기.xlsx 의 '단가표' 시트 기준 (2026-07 반영, 미사용 품목 정리됨)
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
  { category: '유포', name: '유포G', price: 27000, perUnit: false },
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
  { category: '현수막', name: '텐트천', price: 10000, perUnit: false },
  // 페트배너
  { category: '페트배너', name: '페트', price: 30000, perUnit: false },
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
  { category: '기타', name: '투명시트', price: 30000, perUnit: false, note: '정면 40,000원' },
  { category: '기타', name: '백릿', price: 30000, perUnit: false },
  { category: '기타', name: '캔버스', price: 45000, perUnit: false },
  { category: '기타', name: '캔버스액자제작', price: 120000, perUnit: false },
];
