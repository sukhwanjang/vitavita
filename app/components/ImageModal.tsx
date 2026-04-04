'use client';
import { useState, useEffect, useRef } from 'react';
import { CheckMark } from './types';
import { getRenderedRect } from './utils/imageUtils';

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

  if (!imageUrl) return null;

  const handleClose = () => {
    onClose();
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY;
    const zoomStep = 0.1;
    
    if (delta > 0) {
      setZoom(prevZoom => Math.max(0.5, Math.round((prevZoom - zoomStep) * 10) / 10));
    } else {
      setZoom(prevZoom => Math.min(5, Math.round((prevZoom + zoomStep) * 10) / 10));
    }
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

    // 근처 마크 찾기 (이미지 픽셀 공간에서 비교)
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300 animate-fadein"
      onClick={handleClose}
    >
      <div className="relative flex flex-col items-center" onClick={handleModalClick}>
        {(company || program) && (
          <div className="text-white text-center mb-4">
            {company && <div className="text-4xl font-bold">{company}</div>}
            {program && <div className="text-3xl text-gray-200">{program}</div>}
          </div>
        )}
        
        <div 
          ref={imageContainerRef}
          className="relative overflow-hidden rounded-xl shadow-2xl bg-white"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleRightClick}  // 변경: 우클릭 이벤트로 체크마크 생성/삭제
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            width: '80vw',
            height: '80vh'
          }}
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
            {/* 이미지 기준 % → 컨테이너 기준 % 변환 후 렌더링 */}
            {naturalDims && containerDims && checkMarks.map((mark, index) => {
              const imgRect = getRenderedRect(containerDims.w, containerDims.h, naturalDims.w, naturalDims.h);
              const containerX = (imgRect.x + (mark.x / 100) * imgRect.w) / containerDims.w * 100;
              const containerY = (imgRect.y + (mark.y / 100) * imgRect.h) / containerDims.h * 100;
              return (
                <div
                  key={index}
                  className="absolute flex items-center justify-center w-12 h-12 bg-green-500 rounded-full border-2 border-black shadow-lg"
                  style={{
                    left: `${containerX}%`,
                    top: `${containerY}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
        <button
          className="absolute top-2 right-2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70 transition"
          onClick={handleClose}
        >
          ×
        </button>
      </div>
    </div>
  );
} 