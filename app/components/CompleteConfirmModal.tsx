'use client';
import { RequestItem } from './types';

interface CompleteConfirmModalProps {
  item: RequestItem | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CompleteConfirmModal({ item, onConfirm, onCancel }: CompleteConfirmModalProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-md relative animate-fadein">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">작업 완료 확인</h3>
          <p className="text-gray-600">아래 작업을 완료 처리하시겠습니까?</p>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">프로그램:</span>
              <span className="font-semibold text-gray-900">{item.program}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">업체명:</span>
              <span className="font-semibold text-gray-900">{item.company}</span>
            </div>
            {item.creator && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-20">작업자:</span>
                <span className="font-semibold text-gray-900">{item.creator}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
          >
            취소
          </button>
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