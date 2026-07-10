'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem } from './types';
import { getRenderedRect } from './utils/imageUtils';
import { IconCheckCircle, IconZoomIn } from './ui/icons';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg relative animate-fadein max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
            <IconCheckCircle className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">작업 완료 확인</h3>
            {isChained && (
              <p className="text-xs text-slate-400 mt-0.5">
                <b className="text-blue-600 font-semibold">{queueCurrent} / {queueTotal}</b> — 동일 업체·프로그램 연속 처리
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-5">
          {/* 작업 정보 */}
          <dl className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-3.5 mb-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-slate-400 w-16 shrink-0">업체명</dt>
              <dd className="font-semibold text-slate-900">{item.company}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-slate-400 w-16 shrink-0">프로그램</dt>
              <dd className="font-semibold text-slate-900">{item.program}</dd>
            </div>
            {item.creator && (
              <div className="flex items-center gap-2">
                <dt className="text-slate-400 w-16 shrink-0">작업자</dt>
                <dd className="font-semibold text-slate-900">{item.creator}</dd>
              </div>
            )}
            {item.pickup_date && (
              <div className="flex items-center gap-2">
                <dt className="text-slate-400 w-16 shrink-0">픽업일</dt>
                <dd className="font-semibold text-slate-900">{item.pickup_date}</dd>
              </div>
            )}
          </dl>

          {/* 원고 이미지 미리보기 + 체크마크 오버레이 */}
          {item.image_url && (
            <div
              ref={imgContainerRef}
              className="group relative w-full h-64 cursor-pointer"
              onClick={onImageClick}
            >
              <img
                src={item.image_url}
                alt="원고 이미지"
                className="w-full h-64 object-contain rounded-lg border border-slate-200 bg-slate-50"
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
                    <div className="w-6 h-6 bg-emerald-500 rounded-full border border-white shadow flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
              {/* 클릭 유도 오버레이 */}
              <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/10">
                <span className="inline-flex items-center gap-1.5 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-md shadow border border-slate-200">
                  <IconZoomIn className="w-3.5 h-3.5" />
                  크게 보기
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
          <button
            onClick={onCancel}
            className="h-10 px-5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            닫기
          </button>
          {isChained && onSkip && (
            <button
              onClick={onSkip}
              className="h-10 px-5 rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition"
            >
              건너뜀
            </button>
          )}
          <button
            onClick={onConfirm}
            className="h-10 px-6 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 transition"
          >
            완료 처리
          </button>
        </div>
      </div>
    </div>
  );
}
