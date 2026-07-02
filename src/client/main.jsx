import React from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { theme } from "./theme.js";
import { ServerStateProvider } from "./api/useServerState.js";
import HomePage from "./pages/HomePage.jsx";
import ControlListPage from "./pages/ControlListPage.jsx";
import ScoreInputPage from "./pages/ScoreInputPage.jsx";
import LegacyRedirect from "./components/common/LegacyRedirect.jsx";
import ScoreboardPreviewPage from "./pages/ScoreboardPreviewPage.jsx";
import "./styles/scoreboard.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ServerStateProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/preview" element={<ScoreboardPreviewPage />} />
            <Route path="/viewer" element={<LegacyRedirect to="/legacy/#/viewer" />} />
            <Route path="/control" element={<ControlListPage />} />
            <Route path="/control/:boardId" element={<ScoreInputPage />} />
            <Route path="/settings" element={<LegacyRedirect to="/legacy/#/settings" />} />
            <Route
              path="/settings/presets/reorder"
              element={<LegacyRedirect to="/legacy/#/settings/presets/reorder" />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ServerStateProvider>
    </ThemeProvider>
  </React.StrictMode>
);
