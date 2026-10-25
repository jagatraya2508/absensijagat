export const FACE_MATCH_DEFAULT = 60;
export const FACE_MATCH_MIN = 50;
export const FACE_MATCH_MAX = 95;

export function normalizeFaceMatchPercent(value) {
    const percent = parseInt(value, 10);
    if (!Number.isInteger(percent)) return FACE_MATCH_DEFAULT;
    return Math.min(FACE_MATCH_MAX, Math.max(FACE_MATCH_MIN, percent));
}
