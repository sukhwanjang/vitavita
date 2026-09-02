/**
 * request-images 버킷 점검 (읽기 전용 — 아무것도 지우거나 바꾸지 않는다)
 *
 * - 원본/썸네일 파일 수와 용량
 * - DB(request.image_url)에서 참조되지 않는 고아 파일
 * - 썸네일이 아직 없는 원본 (백필 대상)
 *
 * 파일 목록 조회에는 service_role 키가 필요하다 (anon 정책엔 storage SELECT가 없어 0개로 나온다).
 * .env.local 에 SUPABASE_SERVICE_ROLE_KEY 를 넣고 실행할 것.
 *
 * 실행: node scripts/storage-audit.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const BUCKET = 'request-images';
const THUMB_DIR = 'thumb';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const mb = n => (n / 1024 / 1024).toFixed(1) + ' MB';

async function listAll(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list(${prefix}) 실패: ${error.message}`);
    if (!data?.length) break;
    out.push(...data.filter(f => f.id));      // 폴더(id=null)는 제외
    if (data.length < 100) break;
  }
  return out;
}

async function allImageUrls() {
  const urls = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('request')
      .select('image_url')
      .range(from, from + 999);
    if (error) throw new Error(`request 조회 실패: ${error.message}`);
    if (!data?.length) break;
    urls.push(...data.map(r => r.image_url).filter(Boolean));
    if (data.length < 1000) break;
  }
  return urls;
}

const fileNameOfUrl = url => {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
};

const [originals, thumbs, urls] = await Promise.all([
  listAll(''), listAll(THUMB_DIR), allImageUrls(),
]);

const sizeOf = f => f.metadata?.size ?? 0;
const originalBytes = originals.reduce((s, f) => s + sizeOf(f), 0);
const thumbBytes = thumbs.reduce((s, f) => s + sizeOf(f), 0);

const referenced = new Set(urls.map(fileNameOfUrl).filter(Boolean));
const orphans = originals.filter(f => !referenced.has(f.name));
const thumbNames = new Set(thumbs.map(f => f.name));
const needThumb = originals.filter(f => referenced.has(f.name) && !thumbNames.has(f.name));

const orphanBytes = orphans.reduce((s, f) => s + sizeOf(f), 0);
const biggest = [...originals].sort((a, b) => sizeOf(b) - sizeOf(a)).slice(0, 10);

console.log('=== request-images 버킷 현황 ===');
console.log(`원본 파일      ${originals.length}개 · ${mb(originalBytes)}`);
console.log(`썸네일         ${thumbs.length}개 · ${mb(thumbBytes)}`);
console.log(`합계           ${mb(originalBytes + thumbBytes)}`);
console.log();
console.log(`DB 참조 URL    ${urls.length}개 (고유 ${referenced.size}개)`);
console.log(`고아 파일      ${orphans.length}개 · ${mb(orphanBytes)}   ← 삭제 후보`);
console.log(`썸네일 없음    ${needThumb.length}개   ← 백필 대상`);
console.log();
console.log('가장 큰 파일 10개:');
biggest.forEach(f => console.log(`  ${mb(sizeOf(f)).padStart(9)}  ${f.name}`));

writeFileSync(
  new URL('./storage-audit.json', import.meta.url),
  JSON.stringify({ orphans: orphans.map(f => f.name), needThumb: needThumb.map(f => f.name) }, null, 2)
);
console.log('\n상세 목록 → scripts/storage-audit.json');
