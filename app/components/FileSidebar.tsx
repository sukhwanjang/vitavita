'use client';
import { useState } from 'react';
import { useFileDrops } from './hooks/useFileDrops';

// 탐색기 "경로로 복사"(Ctrl+Shift+C)로 붙여넣으면 따옴표가 붙어 오므로 제거
const cleanPath = (raw: string) => raw.trim().replace(/^"+|"+$/g, '');

const fileNameOf = (path: string) => path.split('\\').pop()?.split('/').pop() ?? path;
const folderOf = (path: string) => {
  const name = fileNameOf(path);
  return path.slice(0, path.length - name.length).replace(/[\\/]+$/, '');
};

export default function FileSidebar() {
  const { drops, error, addDrop, removeDrop } = useFileDrops();
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const path = cleanPath(input);
    if (!path) return;
    setIsAdding(true);
    const creator = localStorage.getItem('vitavita_creator');
    const ok = await addDrop(path, creator);
    setIsAdding(false);
    if (ok) setInput('');
  };

  const handleCopy = async (id: number, path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // 클립보드 API가 막힌 환경 대비 폴백
      const ta = document.createElement('textarea');
      ta.value = path;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000);
  };

  const handleRemove = (id: number) => {
    if (!window.confirm('처리 완료! 목록에서 지울까요?')) return;
    removeDrop(id);
  };

  return (
    <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-4 self-start">
      <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-3 border-b border-blue-100">
          <span className="text-lg">📁</span>
          <h2 className="font-bold text-blue-900 text-sm">파일 대기함</h2>
          {drops.length > 0 && (
            <span className="ml-auto bg-blue-600 text-white text-xs font-bold rounded-full px-2.5 py-0.5 animate-pulse">
              {drops.length}
            </span>
          )}
        </div>

        {/* 경로 등록 */}
        <div className="p-3 border-b border-gray-100">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.replace(/^"+|"+$/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="파일 경로 붙여넣기 (Ctrl+V)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-400 transition"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-gray-400 leading-tight">
              탐색기에서 파일 선택 →<br /><b>Ctrl+Shift+C</b> (경로로 복사)
            </p>
            <button
              onClick={handleAdd}
              disabled={isAdding || !cleanPath(input)}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow transition"
            >
              {isAdding ? '등록 중...' : '올리기'}
            </button>
          </div>
        </div>

        {/* 대기 목록 */}
        <div className="max-h-[60vh] overflow-y-auto">
          {error ? (
            <p className="p-4 text-xs text-red-400">
              파일 대기함을 불러올 수 없습니다.<br />({error})
            </p>
          ) : drops.length === 0 ? (
            <p className="p-4 text-xs text-gray-400 text-center">대기 중인 파일이 없습니다</p>
          ) : (
            drops.map(drop => (
              <div key={drop.id} className="px-3 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition">
                <p className="text-xs font-bold text-gray-900 break-all">{fileNameOf(drop.path)}</p>
                <p className="text-[10px] text-gray-400 break-all mt-0.5" title={drop.path}>{folderOf(drop.path)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-500">
                    {drop.creator && <b className="mr-1">{drop.creator}</b>}
                    {new Date(drop.created_at).toLocaleString('ko-KR', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
                    })}
                  </span>
                  <span className="ml-auto flex gap-1">
                    <button
                      onClick={() => handleCopy(drop.id, drop.path)}
                      title={`${drop.path}\n\n클릭하면 경로가 복사됩니다. 탐색기 주소창(Ctrl+L)에 붙여넣고 엔터를 누르면 파일이 열립니다.`}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition ${
                        copiedId === drop.id
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {copiedId === drop.id ? '✓ 복사됨' : '경로 복사'}
                    </button>
                    <button
                      onClick={() => handleRemove(drop.id)}
                      title="처리 완료 (목록에서 제거)"
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                    >
                      확인
                    </button>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
