'use client';
import { RequestItem } from './types';

interface CompleteConfirmModalProps {
  item: RequestItem | null;
  onConfirm: () => void;
  onCancel: () => void;
  onSkip?: () => void;
  queueCurrent?: number;
  queueTotal?: number;
}

export default function CompleteConfirmModal({
  item,
  onConfirm,
  onCancel,
  onSkip,
  queueCurrent = 1,
  queueTotal = 1,
}: CompleteConfirmModalProps) {
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
              <span className="text-blue-400 font-normal">— 동일 업체·프로그램·작업자</span>
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

        {/* 원고 이미지 미리보기 */}
        {item.image_url && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 mb-2">원고 이미지</p>
            <img
              src={item.image_url}
              alt="원고 이미지"
              className="w-full max-h-64 object-contain rounded-xl border bg-gray-50 shadow-sm"
            />
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