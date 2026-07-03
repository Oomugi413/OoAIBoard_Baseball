import React from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { theme } from "./theme.js";
import { ServerStateProvider } from "./api/useServerState.js";
import HomePage from "./pages/HomePage.jsx";
import ViewerPage from "./pages/ViewerPage.jsx";
import ControlListPage from "./pages/ControlListPage.jsx";
import ScoreInputPage from "./pages/ScoreInputPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import PresetReorderPage from "./pages/PresetReorderPage.jsx";
import "./styles/scoreboard.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ServerStateProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/viewer" element={<ViewerPage />} />
            <Route path="/control" element={<ControlListPage />} />
            <Route path="/control/:boardId" element={<ScoreInputPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/presets/reorder" element={<PresetReorderPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ServerStateProvider>
    </ThemeProvider>
  </React.StrictMode>
);
