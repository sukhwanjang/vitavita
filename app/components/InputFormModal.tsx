'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { IconX, IconImage, IconZap, IconCalendar } from './ui/icons';
import { resizeImageFile, storagePathsOf, THUMB_DIR } from './utils/imageResize';
import { WORKER_NAMES } from '../settlement/types';

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

// 여러 장을 한꺼번에 올릴 때의 사진 한 장 (한 장이 작업 한 건이 된다)
type BatchItem = {
  id: number;
  file: File;
  preview: string;   // 화면 표시용 임시 주소 (다 쓰면 revokeObjectURL로 풀어준다)
  label?: string;    // 등록을 누른 순간 정해진 프로그램명 — 일부만 실패해 다시 올릴 때 번호가 바뀌지 않게 고정
};
type SuffixMode = 'number' | 'filename' | 'none';
const MAX_BATCH = 50; // 한 번에 올릴 수 있는 사진 수

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
  const submittingRef = useRef(false); // 처리 중 표시 (화면 갱신을 기다리지 않고 바로 확인하기 위해 ref로도 둔다)
  const [creator, setCreator] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('vitavita_creator') ?? '') : ''
  );
  const [companyFocused, setCompanyFocused] = useState(false);
  const [programFocused, setProgramFocused] = useState(false);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const programInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyIdx, setCompanyIdx] = useState(-1);   // 자동완성에서 화살표로 고른 줄 (-1 = 없음)
  const [programIdx, setProgramIdx] = useState(-1);
  const [dragOver, setDragOver] = useState(false);     // 사진을 끌어다 올리는 중
  const [showMissing, setShowMissing] = useState(false); // 필수 칸 빨간 표시 (등록을 눌렀는데 비어 있을 때)
  // 여러 장 한꺼번에 등록: 사진이 2장 이상 들어오면 여기에 쌓이고, 등록하면 사진마다 작업이 한 건씩 만들어진다
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [suffixMode, setSuffixMode] = useState<SuffixMode>('number'); // 프로그램명 뒤에 붙일 구분
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const batchIdRef = useRef(0);

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

  // 필수 칸을 다 채우면 빨간 표시와 안내 문구를 바로 거둔다
  useEffect(() => {
    if (showMissing && company && program && pickupDate) {
      setShowMissing(false);
      setError(null);
    }
  }, [showMissing, company, program, pickupDate]);

  // 사진 한 장 받기 — 붙여넣기·끌어다 놓기·파일 선택이 모두 여기로 온다
  const takeImageFile = useCallback((file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 올릴 수 있습니다.');
      return;
    }
    setError(null);
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  // 사진 여러 장 받기 — 한 장이면 기존처럼, 두 장 이상이면 "한 장씩 따로 등록" 목록에 쌓는다
  const takeImageFiles = useCallback((list?: FileList | File[] | null) => {
    const all = Array.from(list ?? []);
    if (all.length === 0) return;
    const files = all.filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('이미지 파일만 올릴 수 있습니다.');
      return;
    }
    // 수정할 때는 작업 한 건만 다루므로 첫 장만 쓴다
    if (editMode || (files.length === 1 && batch.length === 0)) {
      takeImageFile(files[0]);
      return;
    }
    // 이미 한 장 올려둔 상태에서 여러 장을 더 넣으면 그 한 장도 목록에 포함한다
    const incoming = batch.length === 0 && image ? [image, ...files] : files;
    const room = MAX_BATCH - batch.length;
    if (incoming.length > room) {
      setError(`한 번에 ${MAX_BATCH}장까지만 올릴 수 있습니다. 넘는 사진은 빠졌습니다.`);
    } else {
      setError(null);
    }
    const added = incoming.slice(0, Math.max(0, room)).map(file => ({
      id: ++batchIdRef.current,
      file,
      preview: URL.createObjectURL(file),
    }));
    setBatch([...batch, ...added]);
    setImage(null);
    setImagePreview(null);
  }, [editMode, batch, image, takeImageFile]);

  // 목록에서 한 장 빼기. 한 장만 남으면 보통의 한 장 등록으로 되돌린다.
  const removeBatchItem = (id: number) => {
    const target = batch.find(b => b.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    const rest = batch.filter(b => b.id !== id);
    if (rest.length === 1) {
      URL.revokeObjectURL(rest[0].preview);
      setBatch([]);
      takeImageFile(rest[0].file);
    } else {
      setBatch(rest);
    }
  };

  const clearBatch = () => {
    batch.forEach(b => URL.revokeObjectURL(b.preview));
    setBatch([]);
  };

  // 사진별 프로그램명: 입력한 프로그램명 뒤에 번호나 파일명을 붙여 카드끼리 구분되게 한다
  const batchProgramName = (item: BatchItem, index: number, total: number) => {
    if (item.label) return item.label;
    const base = program.trim();
    if (suffixMode === 'number') return `${base} (${index + 1}/${total})`.trim();
    if (suffixMode === 'filename') {
      const name = item.file.name.replace(/\.[^.]+$/, '');
      return base ? `${base} - ${name}` : name;
    }
    return base;
  };

  const handlePasteImage = useCallback((e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) takeImageFiles(files);
  }, [takeImageFiles]);

  useEffect(() => {
    if (showForm) {
      window.addEventListener('paste', handlePasteImage as any);
      return () => window.removeEventListener('paste', handlePasteImage as any);
    }
  }, [showForm, handlePasteImage]);

  const uploadImage = async (file: File, tag = ''): Promise<string | null> => {
    // 저장 이름에는 영문·숫자만 남긴다 (한글이나 특수문자가 든 파일명 때문에 올리기가 막히지 않게).
    // tag는 여러 장을 같은 순간에 올릴 때 이름이 겹치지 않게 하는 순번이다.
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
    const fileName = `${Date.now()}_${tag}${safeName}`;
    // 파일명이 매번 다르므로 오래 캐시해도 안전하다. 캐시가 짧으면 같은 사진을 반복해서 내려받게 된다.
    const cacheControl = '31536000';

    // 원본을 그대로 올리면 사진 한 장이 수 MB라 목록에서 트래픽이 폭증한다 → 긴 변 1600px로 줄여서 올린다
    const full = await resizeImageFile(file, 1600, 0.8);
    const { error } = await supabase.storage
      .from('request-images')
      .upload(fileName, full, { cacheControl, contentType: full.type });
    if (error) {
      setError(`이미지 업로드 실패: ${error.message}`);
      return null;
    }

    // 카드 목록용 썸네일. 실패해도 화면에서 원본으로 폴백되므로 업로드 자체를 막지는 않는다.
    try {
      const thumb = await resizeImageFile(file, 400, 0.7, '_thumb');
      await supabase.storage
        .from('request-images')
        .upload(THUMB_DIR + fileName, thumb, { cacheControl, contentType: thumb.type });
    } catch {
      // 썸네일은 없어도 동작한다
    }

    const { data } = supabase.storage.from('request-images').getPublicUrl(fileName);
    return data?.publicUrl ?? null;
  };

  const handleSubmit = async () => {
    // 처리 중에 Ctrl+Enter를 한 번 더 눌러도 같은 작업이 두 번 등록되지 않게 막는다
    // (버튼은 처리 중에 잠기지만 단축키는 잠기지 않았다)
    if (submittingRef.current) return;
    if (!company || !program || !pickupDate) {
      setError('업체명, 프로그램명, 픽업일은 필수입니다.');
      setShowMissing(true);
      return;
    }
    submittingRef.current = true;
    try {
      if (batch.length > 0 && !editMode) await submitBatch();
      else await submitForm();
    } finally {
      submittingRef.current = false;
    }
  };

  const submitForm = async () => {
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
    } else if (imageUrl?.startsWith('data:')) {
      // 미리보기가 base64로만 남은 경우에도 반드시 스토리지에 올린다
      // (base64가 DB에 그대로 저장되면 행 하나가 수 MB가 되어 현황판 전체가 느려짐)
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], 'pasted_image.png', { type: blob.type || 'image/png' });
      const uploaded = await uploadImage(file);
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

  // 여러 장 등록: 사진을 3장씩 동시에 올린 뒤, 올라간 사진마다 작업을 한 건씩 만든다
  const submitBatch = async () => {
    setIsSubmitting(true);
    setError(null);
    const total = batch.length;
    const items = batch.map((b, i) => ({ ...b, label: batchProgramName(b, i, total) }));
    setBatch(items);
    setProgress({ done: 0, total });

    const urls: (string | null)[] = new Array(total).fill(null);
    let next = 0;
    let done = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= total) return;
        try {
          urls[i] = await uploadImage(items[i].file, `${i}_`);
        } catch {
          urls[i] = null;
        }
        done++;
        setProgress({ done, total });
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    // 목록 순서대로 한 번에 넣어 현황판에서도 같은 순서로 보이게 한다
    const rows = items.flatMap((b, i) => urls[i] ? [{
      company,
      program: b.label,
      pickup_date: pickupDate,
      note,
      image_url: urls[i],
      is_urgent: isUrgent,
      completed: false,
      is_deleted: false,
      creator,
    }] : []);

    if (rows.length > 0) {
      const { error } = await supabase.from('request').insert(rows);
      if (error) {
        // 작업이 만들어지지 않았으니 방금 올린 사진 파일도 치운다 (안 그러면 저장소에 주인 없는 파일이 남는다)
        const orphans = urls.flatMap(u => storagePathsOf(u));
        if (orphans.length) supabase.storage.from('request-images').remove(orphans).then(() => {});
        setError(`등록 실패: ${error.message}`);
        setProgress(null);
        setIsSubmitting(false);
        return;
      }
    }

    const failed = items.filter((_, i) => !urls[i]);
    items.forEach((b, i) => { if (urls[i]) URL.revokeObjectURL(b.preview); });
    setProgress(null);
    setIsSubmitting(false);

    if (failed.length > 0) {
      // 올라간 것은 목록에서 빼고, 못 올린 사진만 남겨 다시 누르면 그것만 올라가게 한다
      setBatch(failed);
      setError(`${total}장 중 ${rows.length}장 등록, ${failed.length}장은 올리지 못했습니다. 등록을 다시 누르면 남은 사진만 올립니다.`);
      return;
    }
    setBatch([]);
    clearForm();
    onSuccess();
  };

  const clearForm = () => {
    batch.forEach(b => URL.revokeObjectURL(b.preview));
    setBatch([]);
    setProgress(null);
    setCompany('');
    setProgram('');
    setPickupDate('');
    setNote('');
    setImage(null);
    setImagePreview(null);
    setIsUrgent(false);
    setError(null);
    setShowMissing(false);
    setCompanyIdx(-1);
    setProgramIdx(-1);
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

  // 자동완성 키보드 조작: ↓↑로 고르고 Enter(또는 Tab)로 넣는다.
  // 한글을 조합하는 중의 Enter는 글자 확정이므로 건드리지 않는다.
  const onCompanyKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const list = filteredSuggestions;
    if (e.key === 'ArrowDown' && list.length) {
      e.preventDefault();
      setCompanyFocused(true);
      setCompanyIdx(i => (i + 1) % list.length);
    } else if (e.key === 'ArrowUp' && list.length) {
      e.preventDefault();
      setCompanyIdx(i => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (companyFocused && companyIdx >= 0 && list[companyIdx]) setCompany(list[companyIdx]);
      setCompanyIdx(-1);
      setCompanyFocused(false);
      programInputRef.current?.focus(); // 다음 칸으로
    } else if (e.key === 'Tab' && companyFocused && companyIdx >= 0 && list[companyIdx]) {
      setCompany(list[companyIdx]);
      setCompanyIdx(-1);
    }
  };
  const onProgramKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const list = programCandidates;
    if (e.key === 'ArrowDown' && list.length) {
      e.preventDefault();
      setProgramFocused(true);
      setProgramIdx(i => (i + 1) % list.length);
    } else if (e.key === 'ArrowUp' && list.length) {
      e.preventDefault();
      setProgramIdx(i => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (programFocused && programIdx >= 0 && list[programIdx]) setProgram(list[programIdx]);
      setProgramIdx(-1);
      setProgramFocused(false);
    } else if (e.key === 'Tab' && programFocused && programIdx >= 0 && list[programIdx]) {
      setProgram(list[programIdx]);
      setProgramIdx(-1);
    }
  };

  const inputBase = "rounded-lg border dark:bg-slate-800 px-3.5 h-11 text-sm text-slate-900 dark:text-slate-100 focus:border-brand dark:focus:border-blue-500 focus:ring-4 focus:ring-brand/10 dark:focus:ring-blue-500/20 transition";
  const inputClass = `${inputBase} border-slate-300 dark:border-slate-600`;
  // 필수 칸이 비어 있으면 빨간 테두리
  const requiredClass = (filled: boolean) =>
    `${inputBase} ${showMissing && !filled ? 'border-red-400 bg-red-50/60 dark:bg-red-950/30' : 'border-slate-300 dark:border-slate-600'}`;
  const labelClass = "text-[13px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5";
  const fmtShort = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`;
  };
  const summaryReady = company && pickupDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 backdrop-blur-sm p-4" onPaste={handlePasteImage}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl relative animate-fadein max-h-[92vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-orange/15 text-brand-orange-dark dark:text-brand-orange text-xl font-black select-none">
              {editMode ? '✎' : '+'}
            </span>
            <div>
              <h3 className="text-lg font-extrabold tracking-tight text-brand dark:text-slate-100">{editMode ? '작업 수정' : '새 작업 등록'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{editMode ? '작업 내용을 수정합니다.' : '업체명부터 차례로 적으면 됩니다. * 표시는 꼭 필요한 칸입니다.'}</p>
            </div>
          </div>
          <button
            className="flex items-center justify-center w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
            onClick={clearForm}
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* 본문: 좌 입력 폼 / 우 원고 이미지 */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100 dark:divide-slate-800">
            {/* 좌측: 작업 정보 */}
            <div className="px-6 py-5 space-y-5">
              {/* 업체명 + 자동완성 */}
              <div className="flex flex-col relative">
                <label className={labelClass}>업체명 <span className="text-red-500">*</span></label>
                <input
                  ref={companyInputRef}
                  type="text"
                  value={company}
                  onChange={e => { setCompany(e.target.value); setCompanyIdx(-1); setCompanyFocused(true); }}
                  onFocus={() => setCompanyFocused(true)}
                  onBlur={() => setTimeout(() => setCompanyFocused(false), 150)}
                  onKeyDown={onCompanyKey}
                  placeholder="업체명 입력 (↓↑로 고르고 Enter)"
                  autoFocus
                  autoComplete="off"
                  className={requiredClass(!!company)}
                />
                {/* 자동완성 드롭다운 */}
                {companyFocused && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl z-20 overflow-hidden">
                    {filteredSuggestions.map((c, i) => (
                      <button
                        key={c}
                        tabIndex={-1}
                        onMouseDown={(e) => { e.preventDefault(); setCompany(c); setCompanyIdx(-1); setCompanyFocused(false); programInputRef.current?.focus(); }}
                        onMouseEnter={() => setCompanyIdx(i)}
                        className={`w-full text-left px-3.5 py-2 text-sm transition border-b border-slate-50 dark:border-slate-700 last:border-b-0 ${
                          i === companyIdx
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
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
                        className="inline-flex items-center h-7 px-2.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-300 hover:text-blue-700 dark:hover:text-blue-300 transition"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 프로그램명 + 자동완성 */}
              <div className="flex flex-col relative">
                <label className={labelClass}>프로그램명 <span className="text-red-500">*</span></label>
                <input
                  ref={programInputRef}
                  type="text"
                  value={program}
                  onChange={e => { setProgram(e.target.value); setProgramIdx(-1); setProgramFocused(true); }}
                  onFocus={() => setProgramFocused(true)}
                  onBlur={() => setTimeout(() => setProgramFocused(false), 150)}
                  onKeyDown={onProgramKey}
                  placeholder={company && companyPrograms.length > 0 ? `${company}의 최근 프로그램 (↓↑로 고르기)` : '프로그램명 입력'}
                  autoComplete="off"
                  className={requiredClass(!!program)}
                />
                {/* 자동완성 드롭다운 */}
                {programFocused && programCandidates.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl z-20 overflow-hidden">
                    {!program && (
                      <p className="px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 select-none">
                        {company}의 최근 프로그램
                      </p>
                    )}
                    {programCandidates.map((p, i) => (
                      <button
                        key={p}
                        tabIndex={-1}
                        onMouseDown={(e) => { e.preventDefault(); setProgram(p); setProgramIdx(-1); setProgramFocused(false); }}
                        onMouseEnter={() => setProgramIdx(i)}
                        className={`w-full text-left px-3.5 py-2 text-sm transition border-b border-slate-50 dark:border-slate-700 last:border-b-0 ${
                          i === programIdx
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
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
                  <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">픽업일 <span className="text-red-500">*</span></label>
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
                        className={`flex-1 flex flex-col items-center justify-center h-12 rounded-lg border transition ${
                          active
                            ? 'bg-brand dark:bg-blue-600 text-white border-brand dark:border-blue-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-brand/40 hover:text-brand dark:hover:text-blue-300'
                        }`}
                      >
                        <span className="text-[13px] font-bold leading-tight">{q.label}</span>
                        <span className={`text-[11px] leading-tight tabular-nums ${active ? 'text-white/70' : 'text-slate-400'}`}>{fmtShort(dateStr)}</span>
                      </button>
                    );
                  })}
                </div>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={e => setPickupDate(e.target.value)}
                  className={requiredClass(!!pickupDate)}
                />
              </div>

              {/* 작업자 선택 */}
              <div className="flex flex-col">
                <label className={labelClass}>작업자 선택</label>
                <div className="grid grid-cols-3 gap-2">
                  {WORKER_NAMES.map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setCreator(name);
                        localStorage.setItem('vitavita_creator', name);
                      }}
                      className={`h-10 rounded-lg text-sm font-semibold border transition ${
                        creator === name
                          ? 'bg-brand dark:bg-blue-600 text-white border-brand dark:border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-brand/40 hover:text-brand dark:hover:text-blue-300'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메모 */}
              <div className="flex flex-col">
                <label className={labelClass}>메모</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="코팅, 재단, 납품 방법처럼 작업할 때 알아야 할 것"
                  className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-brand dark:focus:border-blue-500 focus:ring-4 focus:ring-brand/10 dark:focus:ring-blue-500/20 transition"
                  rows={3}
                />
              </div>

              {/* 우선순위 세그먼트 */}
              <div className="flex flex-col">
                <label className={labelClass}>우선순위</label>
                <div className="inline-flex w-full rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsUrgent(false)}
                    className={`flex-1 h-10 text-sm font-semibold transition ${
                      !isUrgent ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    일반
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUrgent(true)}
                    className={`flex-1 h-10 inline-flex items-center justify-center gap-1 text-sm font-semibold transition border-l border-slate-200 dark:border-slate-600 ${
                      isUrgent ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400'
                    }`}
                  >
                    <IconZap className="w-3.5 h-3.5" />
                    급함
                  </button>
                </div>
              </div>

            </div>

            {/* 우측: 원고 이미지 */}
            <div className="px-6 py-5 flex flex-col">
              <label className={labelClass}>원고 이미지</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={!editMode}
                className="hidden"
                onChange={e => { takeImageFiles(e.target.files); e.target.value = ''; }}
              />
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); takeImageFiles(e.dataTransfer.files); }}
                onClick={imagePreview || batch.length > 0 ? undefined : () => fileInputRef.current?.click()}
                className={`flex-1 min-h-[320px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 transition ${
                  dragOver
                    ? 'border-brand-orange bg-orange-50 dark:bg-orange-950/30'
                    : imagePreview || batch.length > 0
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-brand-orange hover:bg-orange-50/50 dark:hover:bg-orange-950/20 cursor-pointer'
                }`}
              >
                {batch.length > 0 ? (
                  <div className="w-full h-full flex flex-col self-stretch">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-extrabold text-brand dark:text-slate-100">사진 {batch.length}장</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">→ 작업 {batch.length}건으로 따로 등록됩니다</span>
                      <button
                        onClick={clearBatch}
                        disabled={isSubmitting}
                        className="ml-auto inline-flex items-center h-7 px-2.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 transition disabled:opacity-50"
                      >
                        모두 빼기
                      </button>
                    </div>
                    {/* 프로그램명 뒤에 붙일 구분 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">프로그램명 뒤에</span>
                      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                        {([['number', '번호'], ['filename', '파일명'], ['none', '안 붙임']] as [SuffixMode, string][]).map(([mode, text], i) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSuffixMode(mode)}
                            disabled={isSubmitting}
                            className={`h-7 px-2.5 text-[11px] font-semibold transition ${i > 0 ? 'border-l border-slate-200 dark:border-slate-600' : ''} ${
                              suffixMode === mode
                                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                                : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            }`}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[330px] pr-1">
                      {batch.map((b, i) => (
                        <div key={b.id} className="relative rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                          <img src={b.preview} className="w-full h-20 object-contain bg-white" />
                          <p className="px-1.5 py-1 text-[10px] leading-tight text-slate-600 dark:text-slate-300 truncate border-t border-slate-100 dark:border-slate-700" title={batchProgramName(b, i, batch.length)}>
                            {batchProgramName(b, i, batch.length) || '(프로그램명 없음)'}
                          </p>
                          {!isSubmitting && (
                            <button
                              onClick={() => removeBatchItem(b.id)}
                              aria-label="이 사진 빼기"
                              className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-slate-900/60 text-white hover:bg-red-600 transition"
                            >
                              <IconX className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="shrink-0 inline-flex items-center h-7 px-2.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:border-brand/40 hover:text-brand dark:hover:text-white transition disabled:opacity-50"
                      >
                        사진 더 넣기
                      </button>
                      <span className="text-[11px] text-slate-400">끌어다 놓으면 뒤에 이어 붙습니다 · 업체명·픽업일·메모는 모두 같게 들어갑니다</span>
                    </div>
                  </div>
                ) : imagePreview ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img src={imagePreview} className="max-h-[380px] max-w-full object-contain border border-slate-200 rounded bg-white" />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setImage(null); setImagePreview(null); }}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 transition"
                      >
                        <IconX className="w-3 h-3" />
                        이미지 제거
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center h-7 px-2.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:border-brand/40 hover:text-brand dark:hover:text-white transition"
                      >
                        다른 파일 선택
                      </button>
                      <span className="text-[11px] text-slate-400 self-center">붙여넣거나 끌어다 놓아도 교체됩니다</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm text-center flex flex-col items-center gap-2">
                    <IconImage className="w-10 h-10 text-slate-300" />
                    <span>캡처한 뒤 <b className="text-slate-600 dark:text-slate-300">Ctrl+V</b>로 붙여넣기</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">사진 파일을 여기로 끌어다 놓거나, 눌러서 파일을 골라도 됩니다</span>
                    {!editMode && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">여러 장을 한꺼번에 넣으면 <b className="text-slate-600 dark:text-slate-300">한 장씩 따로 등록</b>됩니다</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-2xl shrink-0">
          {error ? (
            <span className="text-[13px] font-semibold text-red-600 dark:text-red-400">{error}</span>
          ) : (
            <span className="hidden md:inline text-[11px] text-slate-400">
              <b className="text-slate-500 dark:text-slate-300">↓↑ Enter</b> 자동완성 고르기 · <b className="text-slate-500 dark:text-slate-300">Ctrl+Enter</b> 등록 · <b className="text-slate-500 dark:text-slate-300">ESC</b> 닫기
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={clearForm}
              className="h-11 px-5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="h-11 px-7 rounded-lg bg-brand-orange text-sm font-extrabold text-brand shadow-sm hover:bg-brand-orange-dark active:scale-[0.98] transition disabled:bg-slate-300 disabled:text-white"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? progress ? `올리는 중 ${progress.done}/${progress.total}` : '처리 중...'
                : batch.length > 0 && !editMode
                  ? summaryReady ? `${batch.length}건 등록 — ${company} · ${ddayLabel(pickupDate)} 픽업` : `${batch.length}건 등록`
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
