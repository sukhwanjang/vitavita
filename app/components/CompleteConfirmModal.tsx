'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem } from './types';
import { getRenderedRect } from './utils/imageUtils';

interface CompleteConfirmModalProps {
  item: RequestItem | null;
  onConfirm: () => void;
  onCancel: () => void;
  onSkip?: () => void;
  onImageClick?: () => void;
  queueCurrent?: number;
  queueTotal?: number;
}

export default function CompleteConfirmModal({
  item,
  onConfirm,
  onCancel,
  onSkip,
  onImageClick,
  queueCurrent = 1,
  queueTotal = 1,
}: CompleteConfirmModalProps) {
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  const [containerDims, setContainerDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!imgContainerRef.current || !item?.image_url) return;
    const el = imgContainerRef.current;
    setContainerDims({ w: el.clientWidth, h: el.clientHeight });
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      setContainerDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [item?.image_url]);

  // item이 바뀌면 naturalDims 초기화 (다음 이미지 로드 대기)
  useEffect(() => {
    setNaturalDims(null);
  }, [item?.id]);

  if (!item) return null;

  const isChained = queueTotal > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-lg relative animate-fadein max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">작업 완료 확인</h3>
          {isChained && (
            <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full mt-1">
              <span>{queueCurrent} / {queueTotal}</span>
              <span className="text-blue-400 font-normal">— 동일 업체·프로그램</span>
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">업체명:</span>
              <span className="font-semibold text-gray-900">{item.company}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">프로그램:</span>
              <span className="font-semibold text-gray-900">{item.program}</span>
            </div>
            {item.creator && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-20 shrink-0">작업자:</span>
                <span className="font-semibold text-gray-900">{item.creator}</span>
              </div>
            )}
            {item.pickup_date && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-20 shrink-0">픽업일:</span>
                <span className="font-semibold text-gray-900">{item.pickup_date}</span>
              </div>
            )}
          </div>
        </div>

        {/* 원고 이미지 미리보기 + 체크마크 오버레이 */}
        {item.image_url && (
          <div className="mb-6">
            <div
              ref={imgContainerRef}
              className="relative w-full h-64 cursor-pointer"
              onClick={onImageClick}
            >
              <img
                src={item.image_url}
                alt="원고 이미지"
                className="w-full h-64 object-contain rounded-xl border bg-gray-50 shadow-sm"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
              {/* 체크마크 오버레이 */}
              {naturalDims && containerDims && item.check_marks?.map((mark, i) => {
                const imgRect = getRenderedRect(containerDims.w, containerDims.h, naturalDims.w, naturalDims.h);
                const posX = imgRect.x + (mark.x / 100) * imgRect.w;
                const posY = imgRect.y + (mark.y / 100) * imgRect.h;
                return (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{ left: posX, top: posY, transform: 'translate(-50%, -50%)' }}
                  >
                    <div className="w-6 h-6 bg-green-500 rounded-full border border-black shadow flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
              {/* 클릭 유도 오버레이 */}
              <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10">
                <span className="bg-white/80 text-gray-700 text-sm font-semibold px-3 py-1 rounded-full shadow">
                  🔍 크게 보기
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
          >
            닫기
          </button>
          {isChained && onSkip && (
            <button
              onClick={onSkip}
              className="px-6 py-2 rounded-xl bg-yellow-100 text-yellow-800 font-semibold hover:bg-yellow-200 transition"
            >
              건너뜀
            </button>
          )}
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-600 hover:to-green-700 transition shadow-lg"
          >
            완료 처리
          </button>
        </div>
      </div>
    </div>
  );
} 
