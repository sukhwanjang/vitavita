/**
 * request-images 버킷에서 DB(request.image_url)가 참조하지 않는 고아 파일을 지운다.
 *
 * 지금까지 DB 행만 지우고 이미지 파일은 남겨둬서 버킷이 계속 불어났다.
 * (앞으로 생기는 건 useBoardData에서 행 삭제 시 함께 지운다)
 *
 * service_role 키가 필요하다 (anon 정책엔 SELECT/DELETE가 없다).
 * .env.local 에 SUPABASE_SERVICE_ROLE_KEY=... 를 넣고 실행할 것.
 *
 * 실행: node scripts/storage-cleanup.mjs          ← 목록만 보여주고 아무것도 지우지 않음
 *       node scripts/storage-cleanup.mjs --apply  ← 실제 삭제
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const BUCKET = 'request-images';
const THUMB_DIR = 'thumb';
const SAFE_HOURS = 24;   // 최근 업로드분은 DB 반영 전일 수 있으니 건드리지 않는다
const apply = process.argv.includes('--apply');

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다.');
  console.error('Supabase 대시보드 → Project Settings → API Keys → service_role 에서 복사해 넣어주세요.');
  process.exit(1);
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key);

const mb = n => (n / 1024 / 1024).toFixed(1) + ' MB';

async function listAll(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list(${prefix || '/'}) 실패: ${error.message}`);
    if (!data?.length) break;
    out.push(...data.filter(f => f.id));
    if (data.length < 100) break;
  }
  return out;
}

const marker = `/${BUCKET}/`;
const nameOfUrl = url => {
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
};

const referenced = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('request').select('image_url').range(from, from + 999);
  if (error) throw new Error(`request 조회 실패: ${error.message}`);
  if (!data?.length) break;
  data.forEach(r => { const n = r.image_url && nameOfUrl(r.image_url); if (n) referenced.add(n); });
  if (data.length < 1000) break;
}

const [originals, thumbs] = await Promise.all([listAll(''), listAll(THUMB_DIR)]);
const cutoff = Date.now() - SAFE_HOURS * 3600 * 1000;
const isRecent = f => new Date(f.created_at ?? 0).getTime() > cutoff;
const sizeOf = f => f.metadata?.size ?? 0;

// 원본이 참조되지 않으면 원본과 그 썸네일을 함께 정리 대상으로 본다
const orphanOriginals = originals.filter(f => !referenced.has(f.name) && !isRecent(f));
const orphanNames = new Set(orphanOriginals.map(f => f.name));
const orphanThumbs = thumbs.filter(f => !referenced.has(f.name) && !isRecent(f));

const victims = [
  ...orphanOriginals.map(f => ({ path: f.name, size: sizeOf(f) })),
  ...orphanThumbs.map(f => ({ path: `${THUMB_DIR}/${f.name}`, size: sizeOf(f) })),
];
const freed = victims.reduce((s, v) => s + v.size, 0);

console.log(`버킷 파일   원본 ${originals.length}개 · 썸네일 ${thumbs.length}개`);
console.log(`DB 참조     ${referenced.size}개`);
console.log(`정리 대상   ${victims.length}개 · ${mb(freed)}  (최근 ${SAFE_HOURS}시간 업로드분 제외)`);

writeFileSync(new URL('./storage-cleanup-targets.json', import.meta.url),
  JSON.stringify(victims.map(v => v.path), null, 2));
console.log('대상 목록 → scripts/storage-cleanup-targets.json');

if (!apply) {
  console.log('\n실제로 지우려면 --apply 를 붙여 다시 실행하세요. (되돌릴 수 없습니다)');
  process.exit(0);
}

let removed = 0;
for (let i = 0; i < victims.length; i += 100) {
  const batch = victims.slice(i, i + 100).map(v => v.path);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) { console.error(`삭제 실패 (${i}~): ${error.message}`); continue; }
  removed += batch.length;
  console.log(`  ...${removed}/${victims.length}`);
}
console.log(`\n삭제 완료 ${removed}개 · 약 ${mb(freed)} 확보`);
