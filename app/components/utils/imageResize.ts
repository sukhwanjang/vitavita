/**
 * 이미지 업로드/표시 트래픽을 줄이기 위한 유틸.
 *
 * 배경: 원본 사진(수 MB)을 그대로 올리고 카드 목록에도 그대로 띄우던 탓에
 * Supabase egress가 하루 10~25GB까지 치솟아 프로젝트가 쿼터 초과로 정지됐다.
 * 업로드할 때 원본을 줄이고, 목록용 썸네일을 따로 만들어 두는 것으로 해결한다.
 */

const bucketMarker = '/request-images/';

/** 목록용 썸네일이 저장되는 경로 접두사 (원본과 같은 버킷 안의 thumb/ 폴더) */
export const THUMB_DIR = 'thumb/';

/**
 * 원본 public URL에서 썸네일 URL을 만든다.
 * 썸네일 도입 전에 올라간 이미지는 thumb/ 파일이 없으므로,
 * 화면에서는 반드시 onError로 원본 폴백을 걸어야 한다 (ThumbImg 참고).
 */
export function thumbUrlOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const i = url.indexOf(bucketMarker);
  if (i === -1) return url;                                   // 예상 밖 URL은 건드리지 않는다
  const head = url.slice(0, i + bucketMarker.length);
  const tail = url.slice(i + bucketMarker.length);
  if (tail.startsWith(THUMB_DIR)) return url;                 // 이미 썸네일
  return head + THUMB_DIR + tail;
}

/**
 * public URL에서 스토리지 경로(원본 + 썸네일)를 뽑는다. 행을 지울 때 파일도 같이 지우는 용도.
 * DB 행만 지우고 파일을 남겨두면 스토리지가 계속 불어난다.
 */
export function storagePathsOf(url: string | null | undefined): string[] {
  if (!url) return [];
  const i = url.indexOf(bucketMarker);
  if (i === -1) return [];
  const path = decodeURIComponent(url.slice(i + bucketMarker.length).split('?')[0]);
  if (!path || path.startsWith(THUMB_DIR)) return path ? [path] : [];
  return [path, THUMB_DIR + path];
}

/**
 * 이미지를 긴 변 기준 maxSize 이하로 줄여 JPEG로 다시 인코딩한다.
 * - 투명 배경(PNG 붙여넣기)은 흰색으로 채운다. 안 그러면 JPEG에서 검게 나온다.
 * - 줄인 결과가 원본보다 크면 원본을 그대로 쓴다.
 * - 브라우저가 못 읽는 파일이면 원본을 그대로 반환한다 (업로드 자체는 막지 않는다).
 */
export async function resizeImageFile(
  file: File,
  maxSize: number,
  quality: number,
  nameSuffix = ''
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await loadImage(file);
  } catch {
    return file;
  }

  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height;
  if (!w || !h) return file;

  const scale = Math.min(1, maxSize / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, outW, outH);

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if ('close' in bitmap) bitmap.close();
  if (!blob) return file;
  if (blob.size >= file.size && scale === 1) return file;      // 줄일 여지가 없던 경우

  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}${nameSuffix}.jpg`, { type: 'image/jpeg' });
}

function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image decode failed')); };
    img.src = url;
  });
}
