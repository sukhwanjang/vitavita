/**
 * object-contain 이미지가 컨테이너 내에서 실제로 렌더링되는 영역을 계산합니다.
 * 반환값: 컨테이너 좌상단 기준 px 오프셋(x, y)과 렌더링 크기(w, h)
 */
export function getRenderedRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number
): { x: number; y: number; w: number; h: number } {
  const containerRatio = containerW / containerH;
  const imageRatio = naturalW / naturalH;

  let renderedW: number;
  let renderedH: number;
  let offsetX: number;
  let offsetY: number;

  if (imageRatio > containerRatio) {
    // 이미지가 더 넓음 → 가로 꽉 채움, 위아래 여백
    renderedW = containerW;
    renderedH = containerW / imageRatio;
    offsetX = 0;
    offsetY = (containerH - renderedH) / 2;
  } else {
    // 이미지가 더 높음 → 세로 꽉 채움, 좌우 여백
    renderedH = containerH;
    renderedW = containerH * imageRatio;
    offsetX = (containerW - renderedW) / 2;
    offsetY = 0;
  }

  return { x: offsetX, y: offsetY, w: renderedW, h: renderedH };
}
