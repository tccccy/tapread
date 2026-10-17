declare module '*foliate-js/view.js' {
  // 回傳型別在 src/lib/foliate.ts 收斂
  export function makeBook(file: File | Blob | string): Promise<unknown>
}
