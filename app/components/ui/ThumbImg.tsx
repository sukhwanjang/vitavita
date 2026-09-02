'use client';

import { useState, ImgHTMLAttributes } from 'react';
import { thumbUrlOf } from '../utils/imageResize';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string };

/**
 * 카드·목록용 이미지.
 *
 * 원본 대신 썸네일(thumb/)을 먼저 불러오고, 썸네일이 없으면(= 썸네일 도입 전 업로드분)
 * 원본으로 자동 폴백한다. 화면 밖 이미지는 lazy로 아예 받지 않는다.
 * 원본을 크게 봐야 하는 곳(ImageModal, CompleteConfirmModal)에서는 쓰지 않는다.
 */
export default function ThumbImg({ src, onError, ...rest }: Props) {
  const [useOriginal, setUseOriginal] = useState(false);
  const url = useOriginal ? src : (thumbUrlOf(src) ?? src);

  return (
    <img
      {...rest}
      src={url}
      loading="lazy"
      decoding="async"
      onError={e => {
        if (!useOriginal) setUseOriginal(true);
        onError?.(e);
      }}
    />
  );
}
