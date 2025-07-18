'use client';
import { useState } from 'react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export default function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  if (!imageUrl) return null;

  const handleBackgroundClick = () => {
    onClose();
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // 스크롤을 통한 확대축소 기능
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomStep = 0.1;
    
    if (delta > 0) {
      // 스크롤 다운 - 축소
      setZoom(prevZoom => Math.max(0.5, Math.round((prevZoom - zoomStep) * 10) / 10));
    } else {
      // 스크롤 업 - 확대
      setZoom(prevZoom => Math.min(5, Math.round((prevZoom + zoomStep) * 10) / 10));
    }
  };

  // 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setLastPosition(position);
  };

  // 드래그 중
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPosition({
      x: lastPosition.x + deltaX,
      y: lastPosition.y + deltaY
    });
  };

  // 드래그 종료
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 마우스가 컨테이너를 벗어났을 때도 드래그 종료
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300 animate-fadein"
      onClick={handleBackgroundClick}
    >
      <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={handleModalClick}>
        <div className="text-white font-semibold text-base mb-2">
          {(zoom * 100).toFixed(0)}%
        </div>
        <div 
          className="overflow-hidden rounded-xl shadow-2xl bg-white"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <img
            src={imageUrl}
            style={{ 
              transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`, 
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              transformOrigin: 'center center'
            }}
            className="max-h-[80vh] block"
            alt="확대 이미지"
            draggable={false}
          />
        </div>
        <button
          className="absolute top-2 right-2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70 transition"
          onClick={handleBackgroundClick}
        >
          ×
        </button>
        <div className="text-white text-sm mt-2 opacity-70">
          스크롤로 확대/축소 • 드래그로 이동
        </div>
      </div>
    </div>
  );
} 