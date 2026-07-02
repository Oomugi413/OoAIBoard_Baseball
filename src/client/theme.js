import { createTheme } from "@mui/material/styles";

// 自己ホストのWebフォント導入（第2期の手順3以降）までは、CDNに頼らずOS標準フォントで表示する。
export const theme = createTheme({
  palette: {
    primary: { main: "#1f5fbf" },
    background: { default: "#eef1f5" }
  },
  typography: {
    fontFamily: [
      "'Segoe UI'",
      "'Hiragino Sans'",
      "'Yu Gothic UI'",
      "'Noto Sans JP'",
      "sans-serif"
    ].join(", ")
  }
});
