import { createTheme } from "@mui/material/styles";
import { tokens } from "./tokens.js";

export const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: tokens.pageBackground, paper: tokens.paperBackground },
    text: { primary: tokens.textPrimary, secondary: tokens.textSecondary },
    divider: tokens.borderColor,
    primary: { main: tokens.accent, contrastText: tokens.accentContrastText },
    error: { main: tokens.dangerText }
  },
  shape: {
    borderRadius: 14
  },
  typography: {
    fontFamily: [
      "'Noto Sans JP'",
      "'Segoe UI'",
      "'Hiragino Sans'",
      "'Yu Gothic UI'",
      "sans-serif"
    ].join(", "),
    button: { fontWeight: 700, textTransform: "none" }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${tokens.borderColor}`
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          boxSizing: "border-box",
          overflowX: "hidden"
        }
      }
    },
    MuiAppBar: {
      defaultProps: {
        color: "default",
        elevation: 0
      },
      styleOverrides: {
        root: {
          backgroundColor: tokens.paperBackground,
          backgroundImage: "none",
          borderBottom: `1px solid ${tokens.borderColor}`,
          color: tokens.textPrimary
        }
      }
    },
    MuiButton: {
      defaultProps: {
        variant: "contained",
        color: "inherit",
        disableElevation: true
      },
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: 12,
          borderRadius: 8,
          padding: "7px 11px",
          minWidth: 0,
          whiteSpace: "nowrap",
          flexShrink: 0,
          border: "1px solid transparent",
          "&.Mui-disabled": {
            opacity: 0.5
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.inputBackground,
          borderRadius: 8,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.buttonBorder },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: tokens.buttonBorder },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: tokens.accent }
        },
        input: {
          color: tokens.textPrimary
        }
      }
    }
  }
});
