// Explicit UTC keeps a shared observation identical in SSR and browser locales.
export function observedTime(value: string) {
  return `${new Date(value).toISOString().slice(11, 19)} UTC`;
}
