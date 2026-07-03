// @ts-check

/**
 * REST APIへのfetchラッパー。JSONレスポンスを返し、失敗時はErrorをthrowする。
 * エラー時のalert()は行わない。呼び出し側でエラーを処理すること。
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error("サーバーから予期しない応答が返されました。");
    }
    throw new Error("サーバーの応答を読み取れませんでした。");
  }
  if (!response.ok) {
    throw new Error(data.error || "エラーが発生しました。");
  }
  return data;
}
