'use client';
import { useState, useEffect, useRef } from 'react';

interface ImageModalProps {
  imageUrl: string | null;
  company?: string;
  program?: string;
  onClose: () => void;
}

interface CheckMark {
  x: number;
  y: number;
}

export default function ImageModal({ imageUrl, company, program, onClose }: ImageModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const [checkMarks, setCheckMarks] = useState<CheckMark[]>([]);
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

  if (!imageUrl) return null;

  const handleClose = () => {
    onClose();
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setCheckMarks([]); // 모달이 닫힐 때 체크 표시 초기화
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!imageContainerRef.current) return;

    // 1. 클릭된 좌표 계산
    const rect = imageContainerRef.current.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;
    const clickXInContainer = e.clientX - rect.left;
    const clickYInContainer = e.clientY - rect.top;

    const newMarkX = (clickXInContainer - position.x - containerW / 2) / zoom + containerW / 2;
    const newMarkY = (clickYInContainer - position.y - containerH / 2) / zoom + containerH / 2;

    // 2. 근처에 이미 체크 표시가 있는지 확인
    const CLICK_TOLERANCE = 20; // 20px 반경을 '근처'로 간주
    const nearbyMarkIndex = checkMarks.findIndex(mark => {
      const distance = Math.sqrt(Math.pow(mark.x - newMarkX, 2) + Math.pow(mark.y - newMarkY, 2));
      return distance < CLICK_TOLERANCE;
    });

    // 3. 상태 업데이트: 있으면 제거, 없으면 추가
    if (nearbyMarkIndex > -1) {
      // 근처에 마크가 있으면 해당 마크를 제외하고 배열을 새로 만듦
      setCheckMarks(prev => prev.filter((_, index) => index !== nearbyMarkIndex));
    } else {
      // 근처에 마크가 없으면 새로운 마크를 추가
      setCheckMarks(prev => [...prev, { x: newMarkX, y: newMarkY }]);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300 animate-fadein"
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
          onDoubleClick={handleDoubleClick}
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            width: '80vw',
            height: '80vh'
          }}
          onContextMenu={(e) => e.preventDefault()} // 우클릭 메뉴 방지
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
            />
            {checkMarks.map((mark, index) => (
              <div
                key={index}
                className="absolute flex items-center justify-center w-8 h-8 bg-green-500 rounded-full border-2 border-black shadow-lg"
                style={{
                  left: `${mark.x}px`,
                  top: `${mark.y}px`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            ))}
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