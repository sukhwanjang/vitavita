/**
 * 기존에 올라간 원본 이미지들의 목록용 썸네일(thumb/)을 만들어 채운다.
 *
 * 썸네일 도입(2026-09) 이전 업로드분은 카드 목록에서도 원본을 그대로 내려받게 되어
 * egress가 크게 늘어난다. 한 번만 돌려두면 이후로는 업로드 시 자동 생성된다.
 *
 * 실행: node scripts/thumb-backfill.mjs [--limit N] [--dry]
 *   --limit N  앞에서 N개만 처리 (시험용)
 *   --dry      실제 업로드 없이 대상만 센다
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const BUCKET = 'request-images';
const THUMB_DIR = 'thumb/';
const MAX = 400;            // 목록 카드에 쓰기 충분한 크기
const QUALITY = 70;
const CONCURRENCY = 6;
const CACHE = '31536000';

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const dryRun = args.includes('--dry');

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const marker = `/${BUCKET}/`;
const nameOf = url => {
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
};
const thumbUrlOf = url => {
  const i = url.indexOf(marker);
  return url.slice(0, i + marker.length) + THUMB_DIR + url.slice(i + marker.length);
};

// DB에서 참조 중인 이미지 URL 모으기 (중복 제거)
const urls = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('request').select('image_url').range(from, from + 999);
  if (error) throw new Error(`request 조회 실패: ${error.message}`);
  if (!data?.length) break;
  data.forEach(r => { if (r.image_url && nameOf(r.image_url)) urls.add(r.image_url); });
  if (data.length < 1000) break;
}

const targets = [...urls].slice(0, limit === Infinity ? undefined : limit);
console.log(`참조 이미지 ${urls.size}개 / 이번 처리 대상 ${targets.length}개${dryRun ? ' (dry run)' : ''}`);

let made = 0, skipped = 0, failed = 0, srcBytes = 0, outBytes = 0;
const errors = [];

async function work(url) {
  const name = nameOf(url);
  const tUrl = thumbUrlOf(url);
  try {
    const head = await fetch(tUrl, { method: 'HEAD' });
    if (head.ok) { skipped++; return; }                    // 이미 썸네일이 있음

    const res = await fetch(url);
    if (!res.ok) throw new Error(`원본 다운로드 ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    srcBytes += buf.length;

    const thumb = await sharp(buf, { failOn: 'none' })
      .rotate()                                            // EXIF 회전 반영
      .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })                   // 투명 배경은 흰색으로
      .jpeg({ quality: QUALITY })
      .toBuffer();
    outBytes += thumb.length;

    if (dryRun) { made++; return; }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(THUMB_DIR + name, thumb, { cacheControl: CACHE, contentType: 'image/jpeg' });
    // 스토리지 정책에 INSERT만 있고 UPDATE가 없어서 upsert는 못 쓴다. 이미 있으면 그냥 건너뛴다.
    if (error) {
      if (/exists|duplicate/i.test(error.message)) { skipped++; made--; return; }
      throw new Error(`업로드 실패: ${error.message}`);
    }
    made++;
  } catch (e) {
    failed++;
    if (errors.length < 10) errors.push(`${name}: ${e.message}`);
  }
  const done = made + skipped + failed;
  if (done % 50 === 0) console.log(`  ...${done}/${targets.length} (생성 ${made} · 건너뜀 ${skipped} · 실패 ${failed})`);
}

const queue = [...targets];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await work(queue.shift());
  })
);

const mb = n => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log('\n=== 결과 ===');
console.log(`생성 ${made} · 이미 있음 ${skipped} · 실패 ${failed}`);
if (made) console.log(`원본 ${mb(srcBytes)} → 썸네일 ${mb(outBytes)} (${(outBytes / srcBytes * 100).toFixed(1)}%)`);
if (errors.length) { console.log('\n실패 예시:'); errors.forEach(e => console.log('  ' + e)); }
