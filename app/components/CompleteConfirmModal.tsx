'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem, CheckMark, PenPath } from './types';
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
      <div className="bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg relative animate-fadein max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
            <IconCheckCircle className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">작업 완료 확인</h3>
            {isChained && (
              <p className="text-xs text-slate-400 mt-0.5">
                <b className="text-blue-600 font-semibold">{queueCurrent} / {queueTotal}</b> — 동일 업체·프로그램 연속 처리
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-5">
          {/* 작업 정보 */}
          <dl className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded px-4 py-3.5 mb-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-slate-400 w-16 shrink-0">업체명</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{item.company}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-slate-400 w-16 shrink-0">프로그램</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{item.program}</dd>
            </div>
            {item.creator && (
              <div className="flex items-center gap-2">
                <dt className="text-slate-400 w-16 shrink-0">작업자</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">{item.creator}</dd>
              </div>
            )}
            {item.pickup_date && (
              <div className="flex items-center gap-2">
                <dt className="text-slate-400 w-16 shrink-0">픽업일</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">{item.pickup_date}</dd>
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
                className="w-full h-64 object-contain rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
              {/* 주석 오버레이 (핀 + 펜 선) */}
              {naturalDims && containerDims && (() => {
                const imgRect = getRenderedRect(containerDims.w, containerDims.h, naturalDims.w, naturalDims.h);
                const marks = item.check_marks ?? [];
                const pins = marks.filter((m): m is CheckMark => typeof (m as CheckMark).x === 'number');
                const paths = marks.filter((m): m is PenPath => Array.isArray((m as PenPath).points));
                return (
                  <>
                    {paths.length > 0 && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {paths.map((p, i) => (
                          <polyline
                            key={i}
                            points={p.points.map(pt => `${imgRect.x + (pt.x / 100) * imgRect.w},${imgRect.y + (pt.y / 100) * imgRect.h}`).join(' ')}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                      </svg>
                    )}
                    {pins.map((mark, i) => {
                      const posX = imgRect.x + (mark.x / 100) * imgRect.w;
                      const posY = imgRect.y + (mark.y / 100) * imgRect.h;
                      return (
                        <div
                          key={i}
                          className="absolute pointer-events-none"
                          style={{ left: posX, top: posY, transform: 'translate(-50%, -50%)' }}
                        >
                          <div className="w-6 h-6 bg-emerald-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[11px] font-bold select-none">
                            {i + 1}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
              {/* 클릭 유도 오버레이 */}
              <div className="absolute inset-0 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/10">
                <span className="inline-flex items-center gap-1.5 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 rounded shadow border border-slate-200">
                  <IconZoomIn className="w-3.5 h-3.5" />
                  크게 보기
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-md">
          <button
            onClick={onCancel}
            className="h-10 px-5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            닫기
          </button>
          {isChained && onSkip && (
            <button
              onClick={onSkip}
              className="h-10 px-5 rounded border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition"
            >
              건너뜀
            </button>
          )}
          <button
            onClick={onConfirm}
            className="h-10 px-6 rounded bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 transition"
          >
            완료 처리
          </button>
        </div>
      </div>
    </div>
  );
}
