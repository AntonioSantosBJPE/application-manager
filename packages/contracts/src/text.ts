/** Postgres refuses U+0000 in text, so a control character answers `400` instead of `500`. */
export const noControl = (text: string) => !/[\p{Cc}]/u.test(text.replace(/[\n\r\t]/g, ' '));
