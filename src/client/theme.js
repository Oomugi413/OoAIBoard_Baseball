import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#1f5fbf" },
    background: { default: "#eef1f5" }
  },
  typography: {
    fontFamily: [
      "'Noto Sans JP'",
      "'Segoe UI'",
      "'Hiragino Sans'",
      "'Yu Gothic UI'",
      "sans-serif"
    ].join(", ")
  }
});
