'use client';
import { useState, useEffect, useRef } from 'react';
import { CheckMark } from './types';
import { getRenderedRect } from './utils/imageUtils';
import { IconX, IconTrash } from './ui/icons';

interface ImageModalProps {
  imageUrl: string | null;
  company?: string;
  program?: string;
  checkMarks: CheckMark[];
  onCheckMarksChange: (newMarks: CheckMark[]) => void;
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

  const handleClose = () => {
    onClose();
    setZoom(1);
    setPosition({ x: 0, y: 0 });
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
    if (!window.confirm('핀을 모두 지울까요?')) return;
    onCheckMarksChange([]);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!imageContainerRef.current || !naturalDims) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;
    const clickXInContainer = e.clientX - rect.left;
    const clickYInContainer = e.clientY - rect.top;

    // 줌·패닝을 역산하여 원본 컨테이너 공간의 좌표로 변환
    // CSS transform: scale(zoom) translate(position) → 올바른 역변환: (click - origin) / zoom + origin - position
    const actualX = (clickXInContainer - containerW / 2) / zoom + containerW / 2 - position.x;
    const actualY = (clickYInContainer - containerH / 2) / zoom + containerH / 2 - position.y;

    // object-contain 렌더링 영역 계산
    const imgRect = getRenderedRect(containerW, containerH, naturalDims.w, naturalDims.h);

    // 이미지 영역 내 % 좌표로 변환 (화면 크기와 무관하게 동일 위치)
    const newMarkX = ((actualX - imgRect.x) / imgRect.w) * 100;
    const newMarkY = ((actualY - imgRect.y) / imgRect.h) * 100;

    // 이미지 영역 바깥 클릭은 무시
    if (newMarkX < 0 || newMarkX > 100 || newMarkY < 0 || newMarkY > 100) return;

    // 근처 핀 찾기 (이미지 픽셀 공간에서 비교)
    const nearbyMarkIndex = checkMarks.findIndex(mark => {
      const markPxX = imgRect.x + (mark.x / 100) * imgRect.w;
      const markPxY = imgRect.y + (mark.y / 100) * imgRect.h;
      const distance = Math.sqrt(
        Math.pow(actualX - markPxX, 2) +
        Math.pow(actualY - markPxY, 2)
      );
      return distance < 20;
    });

    if (nearbyMarkIndex > -1) {
      onCheckMarksChange(checkMarks.filter((_, index) => index !== nearbyMarkIndex));
    } else {
      onCheckMarksChange([...checkMarks, { x: newMarkX, y: newMarkY }]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 마우스 왼쪽 클릭 (드래그 시작)
    if(e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPosition(position);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setPosition({
      x: lastPosition.x + deltaX,
      y: lastPosition.y + deltaY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90 animate-fadein"
      onClick={handleClose}
    >
      {/* 상단 툴바 */}
      <div
        className="flex items-center gap-3 h-12 px-4 bg-slate-900/95 border-b border-white/10 shrink-0"
        onClick={stop}
      >
        {/* 좌: 작업 정보 */}
        <div className="flex items-baseline gap-2 min-w-0">
          {company && <span className="text-white font-bold text-sm truncate">{company}</span>}
          {program && <span className="text-white/50 text-xs truncate">{program}</span>}
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

        {/* 우: 핀 관리 + 닫기 */}
        <div className="flex items-center gap-2 shrink-0">
          {checkMarks.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold select-none">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold">{checkMarks.length}</span>
                핀
              </span>
              <button
                onClick={handleClearMarks}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white transition"
                title="핀 모두 지우기"
              >
                <IconTrash className="w-3.5 h-3.5" />
                모두 지우기
              </button>
            </>
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleRightClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
            {/* 넘버링 핀 — 이미지 기준 % → 컨테이너 기준 % 변환 후 렌더링 */}
            {naturalDims && containerDims && checkMarks.map((mark, index) => {
              const imgRect = getRenderedRect(containerDims.w, containerDims.h, naturalDims.w, naturalDims.h);
              const containerX = (imgRect.x + (mark.x / 100) * imgRect.w) / containerDims.w * 100;
              const containerY = (imgRect.y + (mark.y / 100) * imgRect.h) / containerDims.h * 100;
              return (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckMarksChange(checkMarks.filter((_, i) => i !== index));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={`핀 ${index + 1} — 클릭하면 삭제`}
                  className="absolute group flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg text-white text-[11px] font-bold cursor-pointer hover:bg-red-500 transition-colors select-none"
                  style={{
                    left: `${containerX}%`,
                    top: `${containerY}%`,
                    // 줌과 무관하게 핀 크기 고정
                    transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                  }}
                >
                  <span className="group-hover:hidden">{index + 1}</span>
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
        <span><b className="text-white/60 font-medium">핀 클릭</b> 삭제</span>
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
