// @ts-check
import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./client.js";

/**
 * @typedef {Object} ServerState
 * @property {Array<any>} boards
 * @property {Array<any>} presets
 * @property {Object} settings
 */

/**
 * @typedef {Object} ServerStateContextValue
 * @property {ServerState} state
 * @property {boolean} connected
 * @property {() => Promise<void>} refresh
 */

const ServerStateContext = createContext(/** @type {ServerStateContextValue | null} */ (null));

const EMPTY_STATE = { boards: [], presets: [], settings: {} };

/**
 * サーバーの状態（boards/presets/settings）をSSEで購読し、配下のコンポーネントへ共有するプロバイダー。
 * @param {{ children: import("react").ReactNode }} props
 */
export function ServerStateProvider({ children }) {
  const [state, setState] = useState(/** @type {ServerState} */ (EMPTY_STATE));
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    const data = await api("/api/state");
    setState(data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    api("/api/state")
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        // 初回取得に失敗してもSSE接続でリカバーを試みる。
      });

    const events = new EventSource("/api/events");

    events.addEventListener("open", () => {
      setConnected(true);
    });
    events.addEventListener("connected", (event) => {
      const data = parseSseData(event.data);
      if (!data) return;
      setState(data);
      setConnected(true);
    });
    events.addEventListener("update", (event) => {
      const data = parseSseData(event.data);
      if (!data) return;
      setState(data.state);
      setConnected(true);
    });
    events.addEventListener("error", () => {
      // EventSourceは自動再接続するため、ここではclose()しない。
      setConnected(false);
    });

    return () => {
      cancelled = true;
      events.close();
    };
  }, []);

  return createElement(ServerStateContext.Provider, { value: { state, connected, refresh } }, children);
}

/**
 * ServerStateProvider配下でサーバー状態を取得するフック。
 * @returns {ServerStateContextValue}
 */
export function useServerState() {
  const value = useContext(ServerStateContext);
  if (!value) {
    throw new Error("useServerStateはServerStateProviderの内部でのみ使用できます。");
  }
  return value;
}

/**
 * SSEイベントのJSONを解析する。壊れたデータは無視し、次のイベントでの回復に任せる。
 * @param {string} raw
 */
function parseSseData(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    console.warn("SSEイベントの解析に失敗しました。");
    return null;
  }
}
