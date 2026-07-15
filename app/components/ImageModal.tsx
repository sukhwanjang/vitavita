'use client';
import { useState, useEffect, useRef } from 'react';
import { Annotation, CheckMark, PenPath } from './types';
import { getRenderedRect } from './utils/imageUtils';
import { IconX, IconTrash } from './ui/icons';

const isPin = (a: Annotation): a is CheckMark => typeof (a as CheckMark).x === 'number';
const isPath = (a: Annotation): a is PenPath => Array.isArray((a as PenPath).points);

interface ImageModalProps {
  imageUrl: string | null;
  company?: string;
  program?: string;
  checkMarks: Annotation[];
  onCheckMarksChange: (newMarks: Annotation[]) => void;
  onClose: () => void;
}

export default function ImageModal({
  imageUrl,
  company,
  program,
  checkMarks,
  onCheckMarksChange,
  onClose
}: ImageModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  const [containerDims, setContainerDims] = useState<{ w: number; h: number } | null>(null);
  // 펜: 그리는 중인 선 (이미지 % 좌표)
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null);
  const penStartRef = useRef<{ x: number; y: number } | null>(null);
  const didPanRef = useRef(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imageUrl) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [imageUrl]);

  // 컨테이너 크기 추적 (화면 리사이즈 대응)
  useEffect(() => {
    if (!imageContainerRef.current || !imageUrl) return;
    const el = imageContainerRef.current;
    setContainerDims({ w: el.clientWidth, h: el.clientHeight });

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      setContainerDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [imageUrl]);

  // ESC로 닫기
  useEffect(() => {
    if (!imageUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!imageUrl) return null;

  const pins = checkMarks.map((m, i) => ({ mark: m, index: i })).filter(x => isPin(x.mark)) as { mark: CheckMark; index: number }[];
  const paths = checkMarks.map((m, i) => ({ mark: m, index: i })).filter(x => isPath(x.mark)) as { mark: PenPath; index: number }[];

  const handleClose = () => {
    onClose();
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setDrawing(null);
  };

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const clampZoom = (z: number) => Math.min(5, Math.max(0.5, Math.round(z * 20) / 20));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY;
    const zoomStep = 0.1;

    if (delta > 0) {
      setZoom(prevZoom => clampZoom(prevZoom - zoomStep));
    } else {
      setZoom(prevZoom => clampZoom(prevZoom + zoomStep));
    }
  };

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleClearMarks = () => {
    if (checkMarks.length === 0) return;
    if (!window.confirm('핀과 펜 선을 모두 지울까요?')) return;
    onCheckMarksChange([]);
  };

  // 화면 좌표 → 이미지 % 좌표 (줌·패닝 역산)
  const clientToImagePct = (clientX: number, clientY: number) => {
    if (!imageContainerRef.current || !naturalDims) return null;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    // CSS transform: scale(zoom) translate(position) → 역변환: (click - origin) / zoom + origin - position
    const actualX = (cx - rect.width / 2) / zoom + rect.width / 2 - position.x;
    const actualY = (cy - rect.height / 2) / zoom + rect.height / 2 - position.y;
    const imgRect = getRenderedRect(rect.width, rect.height, naturalDims.w, naturalDims.h);
    return {
      x: ((actualX - imgRect.x) / imgRect.w) * 100,
      y: ((actualY - imgRect.y) / imgRect.h) * 100,
      actualX,
      actualY,
      imgRect,
    };
  };

  // 짧은 우클릭: 핀 추가/삭제 토글
  const togglePinAt = (clientX: number, clientY: number) => {
    const pos = clientToImagePct(clientX, clientY);
    if (!pos) return;
    const { x, y, actualX, actualY, imgRect } = pos;

    // 이미지 영역 바깥 클릭은 무시
    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    // 근처 핀 찾기 (이미지 픽셀 공간에서 비교)
    const nearby = pins.find(p => {
      const markPxX = imgRect.x + (p.mark.x / 100) * imgRect.w;
      const markPxY = imgRect.y + (p.mark.y / 100) * imgRect.h;
      const distance = Math.sqrt(
        Math.pow(actualX - markPxX, 2) +
        Math.pow(actualY - markPxY, 2)
      );
      return distance < 20;
    });

    if (nearby) {
      onCheckMarksChange(checkMarks.filter((_, index) => index !== nearby.index));
    } else {
      onCheckMarksChange([...checkMarks, { x, y }]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // 왼쪽 클릭: 드래그(패닝) 시작
      didPanRef.current = false;
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPosition(position);
    } else if (e.button === 2) {
      // 오른쪽 클릭: 펜 시작 후보 (움직이면 펜, 그 자리에서 떼면 핀)
      e.preventDefault();
      penStartRef.current = { x: e.clientX, y: e.clientY };
      const pos = clientToImagePct(e.clientX, e.clientY);
      if (pos && pos.x >= 0 && pos.x <= 100 && pos.y >= 0 && pos.y <= 100) {
        setDrawing([{ x: pos.x, y: pos.y }]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 펜 그리기 (오른쪽 버튼 누른 채 이동)
    if (drawing && (e.buttons & 2)) {
      const pos = clientToImagePct(e.clientX, e.clientY);
      if (!pos) return;
      const x = Math.max(0, Math.min(100, pos.x));
      const y = Math.max(0, Math.min(100, pos.y));
      const last = drawing[drawing.length - 1];
      // 너무 촘촘한 점은 생략
      if (Math.abs(x - last.x) + Math.abs(y - last.y) < 0.15) return;
      setDrawing(prev => prev ? [...prev, { x, y }] : prev);
      return;
    }

    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // 일정 거리 이상 움직였으면 "클릭"이 아니라 "패닝"으로 간주
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) didPanRef.current = true;

    setPosition({
      x: lastPosition.x + deltaX,
      y: lastPosition.y + deltaY
    });
  };

  // 이미지 바깥(검정 영역) 클릭 시 뷰어 닫기 — 패닝 직후 클릭은 무시
  const handleCanvasClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    const pos = clientToImagePct(e.clientX, e.clientY);
    if (!pos) return;
    if (pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) {
      handleClose();
    }
  };

  const finishPen = (clientX: number, clientY: number) => {
    const start = penStartRef.current;
    penStartRef.current = null;
    const stroke = drawing;
    setDrawing(null);

    if (!start) return;
    const movedPx = Math.abs(clientX - start.x) + Math.abs(clientY - start.y);

    if (movedPx < 6) {
      // 제자리 우클릭 → 핀 토글
      togglePinAt(start.x, start.y);
    } else if (stroke && stroke.length > 1) {
      // 드래그 → 펜 선 저장
      onCheckMarksChange([...checkMarks, { points: stroke }]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2) {
      finishPen(e.clientX, e.clientY);
      return;
    }
    setIsDragging(false);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (drawing) {
      finishPen(e.clientX, e.clientY);
    }
    setIsDragging(false);
  };

  // 이미지 % 좌표 → 컨테이너 px 좌표
  const pctToContainerPx = (pt: { x: number; y: number }) => {
    if (!containerDims || !naturalDims) return { x: 0, y: 0 };
    const imgRect = getRenderedRect(containerDims.w, containerDims.h, naturalDims.w, naturalDims.h);
    return {
      x: imgRect.x + (pt.x / 100) * imgRect.w,
      y: imgRect.y + (pt.y / 100) * imgRect.h,
    };
  };

  const toPolylinePoints = (pts: { x: number; y: number }[]) =>
    pts.map(pt => { const p = pctToContainerPx(pt); return `${p.x},${p.y}`; }).join(' ');

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90 animate-fadein"
      onClick={handleClose}
    >
      {/* 상단 툴바 */}
      <div
        className="flex items-center gap-3 h-14 px-4 bg-slate-900/95 border-b border-white/10 shrink-0"
        onClick={stop}
      >
        {/* 좌: 작업 정보 (건의: 확대 화면에서 어떤 작업인지 바로 보이게) */}
        <div className="flex items-baseline gap-2.5 min-w-0">
          {company && <span className="text-white font-extrabold text-lg md:text-2xl tracking-tight truncate">{company}</span>}
          {program && <span className="text-sky-300 text-sm md:text-lg font-semibold truncate">{program}</span>}
        </div>

        {/* 중앙: 줌 컨트롤 */}
        <div className="flex items-center gap-1 mx-auto">
          <button
            onClick={() => setZoom(z => clampZoom(z - 0.25))}
            className="flex items-center justify-center w-8 h-8 rounded text-white/60 hover:bg-white/10 hover:text-white transition text-lg font-medium select-none"
            title="축소"
          >
            −
          </button>
          <span className="w-14 text-center text-xs text-white/70 tabular-nums select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => clampZoom(z + 0.25))}
            className="flex items-center justify-center w-8 h-8 rounded text-white/60 hover:bg-white/10 hover:text-white transition text-lg font-medium select-none"
            title="확대"
          >
            +
          </button>
          <button
            onClick={resetView}
            className="ml-1 h-8 px-3 rounded text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition"
            title="원래 크기로"
          >
            화면맞춤
          </button>
        </div>

        {/* 우: 주석 관리 + 닫기 */}
        <div className="flex items-center gap-2 shrink-0">
          {pins.length > 0 && (
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold select-none">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold">{pins.length}</span>
              핀
            </span>
          )}
          {paths.length > 0 && (
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-red-500/15 border border-red-400/30 text-red-300 text-xs font-semibold select-none">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round"><path d="M2 12c3-6 6 4 12-8" /></svg>
              펜 {paths.length}
            </span>
          )}
          {checkMarks.length > 0 && (
            <button
              onClick={handleClearMarks}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white transition"
              title="핀·펜 선 모두 지우기"
            >
              <IconTrash className="w-3.5 h-3.5" />
              모두 지우기
            </button>
          )}
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded text-white/60 hover:bg-white/10 hover:text-white transition"
            title="닫기 (ESC)"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div className="relative flex-1 overflow-hidden" onClick={stop}>
        <div
          ref={imageContainerRef}
          className="absolute inset-0 overflow-hidden"
          onWheel={handleWheel}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: drawing ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              transformOrigin: 'center center',
            }}
          >
            <img
              src={imageUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
              className="block"
              alt="확대 이미지"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />

            {/* 펜 선 레이어 */}
            {naturalDims && containerDims && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                {paths.map(p => (
                  <g key={p.index}>
                    {/* 넓은 투명 히트 영역 — 클릭하면 삭제 */}
                    <polyline
                      points={toPolylinePoints(p.mark.points)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16 / zoom}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCheckMarksChange(checkMarks.filter((_, i) => i !== p.index));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <title>펜 선 — 클릭하면 삭제</title>
                    </polyline>
                    <polyline
                      points={toPolylinePoints(p.mark.points)}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={3}
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
                {/* 그리는 중인 선 미리보기 */}
                {drawing && drawing.length > 1 && (
                  <polyline
                    points={toPolylinePoints(drawing)}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                )}
              </svg>
            )}

            {/* 넘버링 핀 */}
            {naturalDims && containerDims && pins.map((p, order) => {
              const pos = pctToContainerPx(p.mark);
              const containerX = (pos.x / containerDims.w) * 100;
              const containerY = (pos.y / containerDims.h) * 100;
              return (
                <button
                  key={p.index}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckMarksChange(checkMarks.filter((_, i) => i !== p.index));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={`핀 ${order + 1} — 클릭하면 삭제`}
                  className="absolute group flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg text-white text-[11px] font-bold cursor-pointer hover:bg-red-500 transition-colors select-none"
                  style={{
                    left: `${containerX}%`,
                    top: `${containerY}%`,
                    // 줌과 무관하게 핀 크기 고정
                    transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                  }}
                >
                  <span className="group-hover:hidden">{order + 1}</span>
                  <span className="hidden group-hover:block text-[10px]">✕</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 하단 힌트 바 */}
      <div
        className="flex items-center justify-center gap-4 h-9 px-4 bg-slate-900/95 border-t border-white/10 text-[11px] text-white/35 shrink-0 select-none"
        onClick={stop}
      >
        <span><b className="text-white/60 font-medium">우클릭</b> 핀 추가</span>
        <span className="text-white/15">|</span>
        <span><b className="text-white/60 font-medium">우클릭 드래그</b> 펜 그리기</span>
        <span className="text-white/15">|</span>
        <span><b className="text-white/60 font-medium">핀·선 클릭</b> 삭제</span>
        <span className="text-white/15">|</span>
        <span><b className="text-white/60 font-medium">휠</b> 확대·축소</span>
        <span className="text-white/15">|</span>
        <span><b className="text-white/60 font-medium">드래그</b> 이동</span>
        <span className="text-white/15">|</span>
        <span><b className="text-white/60 font-medium">ESC</b> 닫기</span>
      </div>
    </div>
  );
}
