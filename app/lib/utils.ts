// src/app/lib/utils.ts
import { LARGE_ADJECTIVES, LARGE_NOUNS } from './words-data';

/**
 * 무작위 형용사 + 명사 + 2자리 숫자를 조합하여 닉네임을 생성합니다.
 */
export const generateNickname = (): string => {
    const prefix = LARGE_ADJECTIVES[Math.floor(Math.random() * LARGE_ADJECTIVES.length)];
    const suffix = LARGE_NOUNS[Math.floor(Math.random() * LARGE_NOUNS.length)];
    const num = Math.floor(Math.random() * 90 + 10); // 10 ~ 99 사이 숫자

    return `${prefix}${suffix}${num}`;
};