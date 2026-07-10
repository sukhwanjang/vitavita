'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { IconX, IconImage, IconZap, IconCalendar } from './ui/icons';

// 한국 시간 기준 오늘 + offset일의 YYYY-MM-DD
const kstDate = (offsetDays: number) => {
  const now = new Date();
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  korea.setUTCDate(korea.getUTCDate() + offsetDays);
  return korea.toISOString().slice(0, 10);
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const fmtDay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`;
};
const daysLeftOf = (iso: string) =>
  Math.ceil(
    (new Date(iso + 'T00:00:00').getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime())
    / (1000 * 60 * 60 * 24)
  );
const ddayLabel = (iso: string) => {
  const d = daysLeftOf(iso);
  if (d === 0) return '오늘';
  if (d === 1) return '내일';
  if (d < 0) return '지남';
  return `D-${d}`;
};

const QUICK_DATES = [
  { label: '오늘', offset: 0 },
  { label: '내일', offset: 1 },
  { label: '모레', offset: 2 },
  { label: '+3일', offset: 3 },
];

interface InputFormModalProps {
  showForm: boolean;
  editMode: boolean;
  editingId: number | null;
  initialData?: {
    company: string;
    program: string;
    pickupDate: string;
    note: string;
    imageUrl: string | null;
    isUrgent: boolean;
    creator: string;
  };
  companySuggestions?: string[];
  programSuggestions?: { company: string; program: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function InputFormModal({
  showForm,
  editMode,
  editingId,
  initialData,
  companySuggestions = [],
  programSuggestions = [],
  onClose,
  onSuccess
}: InputFormModalProps) {
  const [company, setCompany] = useState('');
  const [program, setProgram] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creator, setCreator] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('vitavita_creator') ?? '') : ''
  );
  const [companyFocused, setCompanyFocused] = useState(false);
  const [programFocused, setProgramFocused] = useState(false);
  const companyInputRef = useRef<HTMLInputElement>(null);

  // 초기 데이터 설정
  useEffect(() => {
    if (initialData) {
      setCompany(initialData.company);
      setProgram(initialData.program);
      setPickupDate(initialData.pickupDate);
      setNote(initialData.note);
      setImagePreview(initialData.imageUrl);
      setIsUrgent(initialData.isUrgent);
      setCreator(initialData.creator);
    }
  }, [initialData]);

  const handlePasteImage = useCallback((e: React.ClipboardEvent) => {
    const file = e.clipboardData.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  useEffect(() => {
    if (showForm) {
      window.addEventListener('paste', handlePasteImage as any);
      return () => window.removeEventListener('paste', handlePasteImage as any);
    }
  }, [showForm, handlePasteImage]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('request-images').upload(fileName, file);
    if (error) {
      setError(`이미지 업로드 실패: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from('request-images').getPublicUrl(fileName);
    return data?.publicUrl ?? null;
  };

  const handleSubmit = async () => {
    if (!company || !program || !pickupDate) {
      setError('업체명, 프로그램명, 픽업일은 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    let imageUrl = imagePreview;

    if (image) {
      const uploaded = await uploadImage(image);
      if (!uploaded) {
        setIsSubmitting(false);
        return;
      }
      imageUrl = uploaded;
    }

    if (editMode && editingId !== null) {
      const { error } = await supabase.from('request').update({
        company,
        program,
        pickup_date: pickupDate,
        note,
        image_url: imageUrl,
        is_urgent: isUrgent,
        creator,
      }).eq('id', editingId);

      if (error) {
        setError(`수정 실패: ${error.message}`);
        setIsSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.from('request').insert([{
        company,
        program,
        pickup_date: pickupDate,
        note,
        image_url: imageUrl,
        is_urgent: isUrgent,
        completed: false,
        is_deleted: false,
        creator,
      }]);
      if (error) {
        alert('등록 실패: ' + error.message);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    clearForm();
    onSuccess();
  };

  const clearForm = () => {
    setCompany('');
    setProgram('');
    setPickupDate('');
    setNote('');
    setImage(null);
    setImagePreview(null);
    setIsUrgent(false);
    // 작업자명은 localStorage에 저장된 값 유지
    setCreator(localStorage.getItem('vitavita_creator') ?? '');
    onClose();
  };

  // 키보드 단축키: ESC 닫기, Ctrl+Enter 등록
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearForm();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!showForm) return null;

  // 업체명 자동완성 후보 (입력값 포함 & 완전 일치 제외)
  const filteredSuggestions = company
    ? companySuggestions.filter(c => c.includes(company) && c !== company).slice(0, 6)
    : [];
  const recentCompanies = companySuggestions.slice(0, 4);

  // 프로그램명 자동완성 — 선택한 업체의 프로그램 우선, 없으면 전체 이력에서
  const companyPrograms = Array.from(new Set(
    programSuggestions.filter(p => p.company === company).map(p => p.program)
  ));
  const allPrograms = Array.from(new Set(programSuggestions.map(p => p.program)));
  const programCandidates = program
    ? (companyPrograms.some(x => x.includes(program)) ? companyPrograms : allPrograms)
        .filter(x => x.includes(program) && x !== program)
        .slice(0, 6)
    : companyPrograms.slice(0, 6); // 입력 전에는 해당 업체의 최근 프로그램을 바로 보여줌

  const inputClass = "rounded border border-slate-300 px-3.5 h-10 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition";
  const summaryReady = company && pickupDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4" onPaste={handlePasteImage}>
      <div className="bg-white rounded-md shadow-xl border border-slate-200 w-full max-w-4xl relative animate-fadein max-h-[92vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">{editMode ? '작업 수정' : '새 작업 등록'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{editMode ? '작업 내용을 수정합니다.' : '새 작업을 현황판에 등록합니다.'}</p>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            onClick={clearForm}
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* 본문: 좌 입력 폼 / 우 원고 이미지 */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
            {/* 좌측: 작업 정보 */}
            <div className="px-6 py-5 space-y-5">
              {/* 업체명 + 자동완성 */}
              <div className="flex flex-col relative">
                <label className="text-[13px] font-medium text-slate-600 mb-1.5">업체명 <span className="text-red-500">*</span></label>
                <input
                  ref={companyInputRef}
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  onFocus={() => setCompanyFocused(true)}
                  onBlur={() => setTimeout(() => setCompanyFocused(false), 150)}
                  placeholder="업체명 입력 (기존 업체 자동완성)"
                  autoFocus
                  className={inputClass}
                />
                {/* 자동완성 드롭다운 */}
                {companyFocused && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-20 overflow-hidden">
                    {filteredSuggestions.map(c => (
                      <button
                        key={c}
                        onMouseDown={(e) => { e.preventDefault(); setCompany(c); setCompanyFocused(false); }}
                        className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition border-b border-slate-50 last:border-b-0"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                {/* 최근 업체 칩 */}
                {!company && recentCompanies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400 self-center">최근:</span>
                    {recentCompanies.map(c => (
                      <button
                        key={c}
                        onClick={() => setCompany(c)}
                        className="inline-flex items-center h-6 px-2 rounded bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 프로그램명 + 자동완성 */}
              <div className="flex flex-col relative">
                <label className="text-[13px] font-medium text-slate-600 mb-1.5">프로그램명 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={program}
                  onChange={e => setProgram(e.target.value)}
                  onFocus={() => setProgramFocused(true)}
                  onBlur={() => setTimeout(() => setProgramFocused(false), 150)}
                  placeholder={company && companyPrograms.length > 0 ? `${company}의 최근 프로그램 자동완성` : '프로그램명 입력'}
                  className={inputClass}
                />
                {/* 자동완성 드롭다운 */}
                {programFocused && programCandidates.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-20 overflow-hidden">
                    {!program && (
                      <p className="px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50 border-b border-slate-100 select-none">
                        {company}의 최근 프로그램
                      </p>
                    )}
                    {programCandidates.map(p => (
                      <button
                        key={p}
                        onMouseDown={(e) => { e.preventDefault(); setProgram(p); setProgramFocused(false); }}
                        className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition border-b border-slate-50 last:border-b-0"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 픽업일: 퀵 칩 + 달력 + D-day 미리보기 */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-[13px] font-medium text-slate-600">픽업일 <span className="text-red-500">*</span></label>
                  {pickupDate && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      daysLeftOf(pickupDate) === 0 ? 'text-blue-600'
                      : daysLeftOf(pickupDate) === 1 ? 'text-amber-600'
                      : daysLeftOf(pickupDate) < 0 ? 'text-red-600'
                      : 'text-slate-500'
                    }`}>
                      <IconCalendar className="w-3 h-3" />
                      {fmtDay(pickupDate)} · {ddayLabel(pickupDate)}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 mb-2">
                  {QUICK_DATES.map(q => {
                    const dateStr = kstDate(q.offset);
                    const active = pickupDate === dateStr;
                    return (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setPickupDate(dateStr)}
                        className={`flex-1 h-8 rounded text-xs font-semibold border transition ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={e => setPickupDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* 작업자 선택 */}
              <div className="flex flex-col">
                <label className="text-[13px] font-medium text-slate-600 mb-1.5">작업자 선택</label>
                <div className="grid grid-cols-3 gap-2">
                  {['박혜경', '김한별', '장석환', '정수원', '이현동', '심민영'].map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setCreator(name);
                        localStorage.setItem('vitavita_creator', name);
                      }}
                      className={`h-9 rounded text-sm font-medium border transition ${
                        creator === name
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메모 */}
              <div className="flex flex-col">
                <label className="text-[13px] font-medium text-slate-600 mb-1.5">메모</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="rounded border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  rows={2}
                />
              </div>

              {/* 우선순위 세그먼트 */}
              <div className="flex flex-col">
                <label className="text-[13px] font-medium text-slate-600 mb-1.5">우선순위</label>
                <div className="inline-flex w-full rounded border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsUrgent(false)}
                    className={`flex-1 h-9 text-sm font-semibold transition ${
                      !isUrgent ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    일반
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUrgent(true)}
                    className={`flex-1 h-9 inline-flex items-center justify-center gap-1 text-sm font-semibold transition border-l border-slate-200 ${
                      isUrgent ? 'bg-red-600 text-white' : 'bg-white text-slate-400 hover:text-red-600'
                    }`}
                  >
                    <IconZap className="w-3.5 h-3.5" />
                    급함
                  </button>
                </div>
              </div>

              {error && <p className="text-red-600 text-[13px]">{error}</p>}
            </div>

            {/* 우측: 원고 이미지 */}
            <div className="px-6 py-5 flex flex-col">
              <label className="text-[13px] font-medium text-slate-600 mb-1.5">원고 이미지</label>
              <div className={`flex-1 min-h-[320px] flex flex-col items-center justify-center border-2 border-dashed rounded p-4 transition ${
                imagePreview ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/60 hover:border-blue-400'
              }`}>
                {imagePreview ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img src={imagePreview} className="max-h-[380px] max-w-full object-contain border border-slate-200 rounded bg-white" />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setImage(null); setImagePreview(null); }}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                      >
                        <IconX className="w-3 h-3" />
                        이미지 제거
                      </button>
                      <span className="text-[11px] text-slate-400 self-center">다시 붙여넣으면 교체됩니다</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm text-center flex flex-col items-center gap-2">
                    <IconImage className="w-10 h-10 text-slate-300" />
                    <span>여기에 이미지를 <b className="text-slate-600">Ctrl+V</b>로 붙여넣으세요</span>
                    <span className="text-xs text-slate-300">(파일 선택 없이 캡처만 지원)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-md shrink-0">
          <span className="hidden md:inline text-[11px] text-slate-400">
            <b className="text-slate-500">Ctrl+Enter</b> 등록 · <b className="text-slate-500">ESC</b> 닫기
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={clearForm}
              className="h-10 px-5 rounded border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="h-10 px-6 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition disabled:bg-slate-300"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? '처리 중...'
                : editMode
                  ? summaryReady ? `수정 — ${company} · ${ddayLabel(pickupDate)} 픽업` : '수정'
                  : summaryReady ? `등록 — ${company} · ${ddayLabel(pickupDate)} 픽업` : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
