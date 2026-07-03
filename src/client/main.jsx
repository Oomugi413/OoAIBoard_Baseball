import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { theme } from "./theme.js";
import { ServerStateProvider } from "./api/useServerState.js";
import "./styles/fonts.css";
import "./styles/scoreboard.css";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const ViewerPage = lazy(() => import("./pages/ViewerPage.jsx"));
const ControlListPage = lazy(() => import("./pages/ControlListPage.jsx"));
const ScoreInputPage = lazy(() => import("./pages/ScoreInputPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const PresetReorderPage = lazy(() => import("./pages/PresetReorderPage.jsx"));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ServerStateProvider>
        <HashRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/viewer" element={<ViewerPage />} />
              <Route path="/control" element={<ControlListPage />} />
              <Route path="/control/:boardId" element={<ScoreInputPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/presets/reorder" element={<PresetReorderPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </ServerStateProvider>
    </ThemeProvider>
  </React.StrictMode>
);
