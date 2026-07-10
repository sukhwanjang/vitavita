'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem, CheckMark, PenPath } from './types';
import { supabase } from '../../lib/supabase';
import { getRenderedRect } from './utils/imageUtils';
import { IconCheckCircle, IconClock, IconFileText, IconRestore, IconTrash } from './ui/icons';

interface CompletedCardProps {
  item: RequestItem;
  onRecover: (id: number) => void;
  onRefresh: () => void;
  onImageClick: (url: string) => void;
  onCompanyClick: (company: string) => void;
}

export default function CompletedCard({ item, onRecover, onRefresh, onImageClick, onCompanyClick }: CompletedCardProps) {
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  const [containerDims, setContainerDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!imgContainerRef.current) return;
    const el = imgContainerRef.current;
    setContainerDims({ w: el.clientWidth, h: el.clientHeight });

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      setContainerDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handlePermanentDelete = async () => {
    if (window.confirm('정말 완전 삭제하시겠습니까?')) {
      await supabase.from('request').delete().eq('id', item.id);
      onRefresh();
    }
  };

  return (
    <div className="relative flex flex-col justify-between rounded overflow-hidden border border-slate-200 bg-white shadow-sm">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
      <div>
        <div className="flex items-center gap-1.5 pl-5 pr-4 pt-3.5">
          <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 select-none">
            <IconCheckCircle className="w-3 h-3" />
            완료
          </span>
        </div>
        <div className="flex flex-col pl-5 pr-4 py-3.5 space-y-3">
          <div>
            <p
              className="text-base font-bold text-slate-900 truncate cursor-pointer hover:text-blue-700 transition"
              onClick={() => onCompanyClick(item.company)}
            >{item.company}</p>
            <p className="text-[13px] text-slate-500 truncate mt-0.5">{item.program}</p>
          </div>
          {item.image_url && (
            <div ref={imgContainerRef} className="relative w-full h-32">
              <img
                src={item.image_url}
                onClick={() => onImageClick(item.image_url!)}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                className="cursor-pointer w-full h-32 object-contain rounded border border-slate-200 bg-slate-50 transition hover:border-blue-300"
                alt="작업 이미지"
              />
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
                          style={{
                            left: posX,
                            top: posY,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <div className="w-5 h-5 bg-emerald-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[10px] font-bold select-none">
                            {i + 1}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          )}

          {/* 메모 */}
          {item.note && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-slate-700">
              <IconFileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{item.note}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pl-5 pr-4 pb-3.5">
        <div className="space-y-1 text-[11px] text-slate-400 mb-3">
          <div className="flex items-center gap-1.5">
            <IconClock className="w-3 h-3" />
            <span>등록</span>
            <span className="text-slate-500">{new Date(item.created_at).toLocaleString('ko-KR')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconCheckCircle className="w-3 h-3" />
            <span>완료</span>
            <span className="text-slate-500">{item.updated_at ? new Date(item.updated_at).toLocaleString('ko-KR') : '-'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 justify-end pt-2.5 border-t border-slate-100">
          <button
            onClick={() => onRecover(item.id)}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <IconRestore className="w-3 h-3" />
            복구
          </button>
          <button
            onClick={handlePermanentDelete}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
          >
            <IconTrash className="w-3 h-3" />
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
