// @ts-check
import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client.js";
import { useServerState } from "../api/useServerState.js";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import TopBar from "../components/common/TopBar.jsx";
import { createTeamLogoDataUrl, uploadTeamLogo } from "../utils/teamLogo.js";

export default function SettingsPage() {
  const { state, refresh } = useServerState();
  const [settingsForm, setSettingsForm] = useState(() => createSettingsForm(state.settings));
  const settingsDirtyFieldsRef = useRef(new Set());
  const [presetForms, setPresetForms] = useState(() => createPresetForms(state.presets || []));
  const presetDirtyFieldsRef = useRef(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deletePresetId, setDeletePresetId] = useState("");
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);

  useEffect(() => {
    setSettingsForm((current) => mergeSettingsForm(current, state.settings, settingsDirtyFieldsRef.current));
  }, [state.settings]);

  useEffect(() => {
    setPresetForms((current) => mergePresetForms(current, state.presets || [], presetDirtyFieldsRef.current));
  }, [state.presets]);

  const updateSettings = (field, value) => {
    settingsDirtyFieldsRef.current.add(field);
    setSettingsForm((current) => ({ ...current, [field]: value }));
  };

  const updatePreset = (presetId, field, value) => {
    markPresetDirty(presetDirtyFieldsRef.current, presetId, [field]);
    setPresetForms((current) => ({
      ...current,
      [presetId]: {
        ...current[presetId],
        [field]: value
      }
    }));
  };

  const handleLogoFile = async (presetId, file) => {
    if (!file) return;
    try {
      const dataUrl = await createTeamLogoDataUrl(file);
      markPresetDirty(presetDirtyFieldsRef.current, presetId, ["pendingLogo", "logoPath"]);
      setPresetForms((current) => ({
        ...current,
        [presetId]: {
          ...current[presetId],
          pendingLogo: dataUrl,
          logoPath: ""
        }
      }));
    } catch (caught) {
      setError(caught.message);
    }
  };

  const clearPresetLogo = (presetId) => {
    markPresetDirty(presetDirtyFieldsRef.current, presetId, ["pendingLogo", "logoPath"]);
    setPresetForms((current) => ({
      ...current,
      [presetId]: {
        ...current[presetId],
        logoPath: "",
        pendingLogo: ""
      }
    }));
  };

  const saveSettings = async () => {
    const submittedFields = new Set(settingsDirtyFieldsRef.current);
    if (!submittedFields.size) {
      setMessage("保存する変更はありません。");
      return;
    }
    const submittedForm = { ...settingsForm };
    const patch = createSettingsPatch(submittedForm, submittedFields);
    setSaving(true);
    try {
      const saved = await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      setSettingsForm((current) => {
        for (const field of submittedFields) {
          if (String(current[field]) === String(submittedForm[field])) {
            settingsDirtyFieldsRef.current.delete(field);
          }
        }
        return mergeSettingsForm(current, saved, settingsDirtyFieldsRef.current);
      });
      await refresh();
      setMessage("全体設定を保存しました。");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const createPreset = async () => {
    setSaving(true);
    try {
      await api("/api/presets", {
        method: "POST",
        body: JSON.stringify({
          presetName: `Team Preset ${(state.presets || []).length + 1}`,
          name: "Team",
          abbreviation: "Team",
          logoPath: "",
          teamColor: "#1f5fbf",
          textColor: "#ffffff",
          abbreviationWidth: 100
        })
      });
      await refresh();
      setMessage("チームプリセットを作成しました。");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const savePreset = async (presetId) => {
    const form = presetForms[presetId];
    if (!form) return;
    setSaving(true);
    try {
      const logoPath = form.pendingLogo ? await uploadTeamLogo(form.pendingLogo) : form.logoPath;
      const saved = await api(`/api/presets/${encodeURIComponent(presetId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          presetName: form.presetName,
          name: form.name,
          abbreviation: form.abbreviation,
          logoPath,
          teamColor: form.teamColor,
          textColor: form.textColor,
          abbreviationWidth: form.abbreviationWidth
        })
      });
      clearPresetDirty(presetDirtyFieldsRef.current, presetId);
      setPresetForms((current) => ({
        ...current,
        [presetId]: createPresetForm(saved)
      }));
      await refresh();
      setMessage("チームプリセットを保存しました。");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePreset = async () => {
    if (!deletePresetId) return;
    setSaving(true);
    try {
      await api(`/api/presets/${encodeURIComponent(deletePresetId)}`, { method: "DELETE" });
      clearPresetDirty(presetDirtyFieldsRef.current, deletePresetId);
      setDeletePresetId("");
      await refresh();
      setMessage("チームプリセットを削除しました。");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const cleanupUnusedLogos = async () => {
    setSaving(true);
    try {
      const result = await api("/api/uploads/unused-team-logos", { method: "DELETE" });
      setCleanupConfirmOpen(false);
      setMessage(`${result.deletedCount || 0}件の未使用ロゴを削除しました。`);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const presets = state.presets || [];
  const deletePresetName = presets.find((preset) => preset.id === deletePresetId)?.presetName || "チームプリセット";

  return (
    <Box>
      <TopBar title="設定" />
      <Box component="main" sx={{ p: 2, maxWidth: 980, mx: "auto" }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        ) : null}
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" component="h2">
                  全体設定
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settingsForm.autoCleanupEnabled}
                      onChange={(event) => updateSettings("autoCleanupEnabled", event.target.checked)}
                      inputProps={{ "data-settings-field": "autoCleanupEnabled" }}
                    />
                  }
                  label="自動削除 ON/OFF"
                />
                <TextField
                  label="自動削除までの時間"
                  type="number"
                  value={settingsForm.autoCleanupIdleHours}
                  onChange={(event) => updateSettings("autoCleanupIdleHours", event.target.value)}
                  slotProps={{ htmlInput: { min: 1, "data-settings-field": "autoCleanupIdleHours" } }}
                />
                <TextField
                  label="一時演出の表示秒数"
                  type="number"
                  value={settingsForm.overlayDisplaySeconds}
                  onChange={(event) => updateSettings("overlayDisplaySeconds", event.target.value)}
                  slotProps={{ htmlInput: { min: 1, "data-settings-field": "overlayDisplaySeconds" } }}
                />
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Button variant="contained" disabled={saving} onClick={saveSettings}>
                    全体設定を保存
                  </Button>
                  <Button disabled={saving} onClick={() => setCleanupConfirmOpen(true)}>
                    未使用ロゴを削除
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                  <Typography variant="h6" component="h2">
                    チームプリセット
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                    <Button variant="contained" disabled={saving} onClick={createPreset}>
                      プリセット作成
                    </Button>
                    <Button component={RouterLink} to="/settings/presets/reorder">
                      プリセット並べ替え
                    </Button>
                  </Stack>
                </Stack>
                {presets.length ? (
                  <Stack spacing={1.5}>
                    {presets.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        form={presetForms[preset.id] || createPresetForm(preset)}
                        saving={saving}
                        onUpdate={updatePreset}
                        onLogoFile={handleLogoFile}
                        onClearLogo={clearPresetLogo}
                        onSave={savePreset}
                        onDelete={setDeletePresetId}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info">チームプリセットがありません。</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
      <ConfirmDialog
        open={Boolean(deletePresetId)}
        title="チームプリセットを削除しますか？"
        message={`「${deletePresetName}」を削除します。スコアボードに読み込み済みのチーム設定は消えません。`}
        confirmLabel="削除する"
        onConfirm={deletePreset}
        onClose={() => setDeletePresetId("")}
      />
      <ConfirmDialog
        open={cleanupConfirmOpen}
        title="未使用ロゴを削除しますか？"
        message="スコアボード/プリセットで使われていないロゴファイルだけを削除します。"
        confirmLabel="削除する"
        onConfirm={cleanupUnusedLogos}
        onClose={() => setCleanupConfirmOpen(false)}
      />
      <Snackbar
        key={message}
        open={Boolean(message)}
        autoHideDuration={4000}
        onClose={() => setMessage("")}
        message={message}
      />
    </Box>
  );
}

function PresetCard({ preset, form, saving, onUpdate, onLogoFile, onClearLogo, onSave, onDelete }) {
  const preview = form.pendingLogo || form.logoPath;
  return (
    <Card variant="outlined" component="section">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" fontWeight="bold">
            {form.presetName || preset.presetName || "Team Preset"}
          </Typography>
          <TextField
            label="プリセット名"
            value={form.presetName}
            onChange={(event) => onUpdate(preset.id, "presetName", event.target.value)}
            slotProps={{ htmlInput: { "data-preset-field": `${preset.id}:presetName` } }}
          />
          <TextField
            label="チーム名"
            value={form.name}
            onChange={(event) => onUpdate(preset.id, "name", event.target.value)}
            slotProps={{ htmlInput: { "data-preset-field": `${preset.id}:name` } }}
          />
          <TextField
            label="略称"
            value={form.abbreviation}
            onChange={(event) => onUpdate(preset.id, "abbreviation", event.target.value)}
            slotProps={{ htmlInput: { "data-preset-field": `${preset.id}:abbreviation` } }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="チーム色"
              type="color"
              value={form.teamColor}
              onChange={(event) => onUpdate(preset.id, "teamColor", event.target.value)}
              slotProps={{ htmlInput: { "data-preset-field": `${preset.id}:teamColor` } }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="文字色"
              type="color"
              value={form.textColor}
              onChange={(event) => onUpdate(preset.id, "textColor", event.target.value)}
              slotProps={{ htmlInput: { "data-preset-field": `${preset.id}:textColor` } }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button component="label" variant="outlined">
              ロゴ画像
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg"
                data-logo-preset={preset.id}
                onChange={(event) => onLogoFile(preset.id, event.target.files?.[0] || null)}
              />
            </Button>
            <Button onClick={() => onClearLogo(preset.id)}>ロゴ削除</Button>
            <Typography variant="body2" color="text.secondary">
              {preview ? "設定済み" : "未設定"}
            </Typography>
          </Stack>
          {preview ? (
            <Box
              component="img"
              src={preview}
              alt=""
              sx={{
                width: 80,
                height: 80,
                objectFit: "contain",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "background.default"
              }}
            />
          ) : null}
          <Divider />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              variant="contained"
              disabled={saving}
              onClick={() => onSave(preset.id)}
              data-save-preset={preset.id}
            >
              保存
            </Button>
            <Button
              color="error"
              disabled={saving}
              onClick={() => onDelete(preset.id)}
              data-delete-preset={preset.id}
            >
              削除
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function createSettingsForm(settings = {}) {
  return {
    autoCleanupEnabled: settings.autoCleanupEnabled !== false,
    autoCleanupIdleHours: String(settings.autoCleanupIdleHours || 24),
    overlayDisplaySeconds: String(settings.overlayDisplaySeconds || 3)
  };
}

const SETTINGS_FORM_FIELDS = ["autoCleanupEnabled", "autoCleanupIdleHours", "overlayDisplaySeconds"];

function mergeSettingsForm(current, settings, dirtyFields = new Set()) {
  const serverForm = createSettingsForm(settings);
  return Object.fromEntries(SETTINGS_FORM_FIELDS.map((field) => [
    field,
    dirtyFields.has(field) ? current[field] : serverForm[field]
  ]));
}

function createSettingsPatch(form, dirtyFields) {
  const patch = {};
  if (dirtyFields.has("autoCleanupEnabled")) {
    patch.autoCleanupEnabled = Boolean(form.autoCleanupEnabled);
  }
  if (dirtyFields.has("autoCleanupIdleHours")) {
    patch.autoCleanupIdleHours = Math.max(1, Number(form.autoCleanupIdleHours || 24));
  }
  if (dirtyFields.has("overlayDisplaySeconds")) {
    patch.overlayDisplaySeconds = Math.max(1, Number(form.overlayDisplaySeconds || 3));
  }
  return patch;
}

function createPresetForms(presets) {
  return Object.fromEntries(presets.map((preset) => [preset.id, createPresetForm(preset)]));
}

const PRESET_FORM_FIELDS = ["presetName", "name", "abbreviation", "logoPath", "pendingLogo", "teamColor", "textColor", "abbreviationWidth"];

function mergePresetForms(current, presets, dirtyFields = new Set()) {
  const next = {};
  for (const preset of presets) {
    const serverForm = createPresetForm(preset);
    next[preset.id] = current[preset.id]
      ? mergePresetForm(current[preset.id], serverForm, preset.id, dirtyFields)
      : serverForm;
  }
  return next;
}

function mergePresetForm(current, serverForm, presetId, dirtyFields) {
  const next = { ...serverForm };
  for (const field of PRESET_FORM_FIELDS) {
    if (dirtyFields.has(`preset:${presetId}:${field}`)) {
      next[field] = current[field];
    }
  }
  return next;
}

function createPresetForm(preset) {
  return {
    presetName: preset.presetName || "",
    name: preset.name || "",
    abbreviation: preset.abbreviation || "",
    logoPath: preset.logoPath || "",
    pendingLogo: "",
    teamColor: preset.teamColor || "#1f5fbf",
    textColor: preset.textColor || "#ffffff",
    abbreviationWidth: Number.isFinite(Number(preset.abbreviationWidth)) ? Number(preset.abbreviationWidth) : 100
  };
}

function markPresetDirty(target, presetId, fields) {
  for (const field of fields) {
    target.add(`preset:${presetId}:${field}`);
  }
}

function clearPresetDirty(target, presetId) {
  for (const key of Array.from(target)) {
    if (key.startsWith(`preset:${presetId}:`)) target.delete(key);
  }
}
