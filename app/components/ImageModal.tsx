'use client';
import { useState } from 'react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export default function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  const [zoom, setZoom] = useState(1);

  if (!imageUrl) return null;

  const handleBackgroundClick = () => {
    onClose();
    setZoom(1);
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300 animate-fadein"
      onClick={handleBackgroundClick}
    >
      <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={handleModalClick}>
        <div className="flex gap-2 mb-2">
          <button 
            onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.2) * 10) / 10))} 
            className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-lg font-bold hover:bg-gray-300 z-50"
          >
            -
          </button>
          <span className="text-white font-semibold text-base">{(zoom * 100).toFixed(0)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.2) * 10) / 10))} 
            className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-lg font-bold hover:bg-gray-300 z-50"
          >
            +
          </button>
        </div>
        <img
          src={imageUrl}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.3s' }}
          className="rounded-xl shadow-2xl max-h-[80vh] bg-white"
          alt="확대 이미지"
        />
        <button
          className="absolute top-2 right-2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70 transition"
          onClick={handleBackgroundClick}
        >
          ×
        </button>
      </div>
    </div>
  );
} 