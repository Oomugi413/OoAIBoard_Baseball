// @ts-check
import { useEffect, useState } from "react";
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

export default function SettingsPage() {
  const { state, refresh } = useServerState();
  const [settingsForm, setSettingsForm] = useState(() => createSettingsForm(state.settings));
  const [presetForms, setPresetForms] = useState(() => createPresetForms(state.presets || []));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deletePresetId, setDeletePresetId] = useState("");
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);

  useEffect(() => {
    setSettingsForm(createSettingsForm(state.settings));
  }, [state.settings]);

  useEffect(() => {
    setPresetForms((current) => mergePresetForms(current, state.presets || []));
  }, [state.presets]);

  const updateSettings = (field, value) => {
    setSettingsForm((current) => ({ ...current, [field]: value }));
  };

  const updatePreset = (presetId, field, value) => {
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
      const dataUrl = await createLogoDataUrl(file);
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

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          autoCleanupEnabled: settingsForm.autoCleanupEnabled,
          autoCleanupIdleHours: Math.max(1, Number(settingsForm.autoCleanupIdleHours || 24)),
          overlayDisplaySeconds: Math.max(1, Number(settingsForm.overlayDisplaySeconds || 3))
        })
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
          textColor: "#ffffff"
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
      const logoPath = form.pendingLogo ? await uploadLogo(form.pendingLogo) : form.logoPath;
      const saved = await api(`/api/presets/${encodeURIComponent(presetId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          presetName: form.presetName,
          name: form.name,
          abbreviation: form.abbreviation,
          logoPath,
          teamColor: form.teamColor,
          textColor: form.textColor
        })
      });
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
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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

function PresetCard({ preset, form, saving, onUpdate, onLogoFile, onSave, onDelete }) {
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
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
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
            <Button onClick={() => onUpdate(preset.id, "logoPath", "")}>ロゴ削除</Button>
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
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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

function createPresetForms(presets) {
  return Object.fromEntries(presets.map((preset) => [preset.id, createPresetForm(preset)]));
}

function mergePresetForms(current, presets) {
  const next = {};
  for (const preset of presets) {
    next[preset.id] = current[preset.id] || createPresetForm(preset);
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
    textColor: preset.textColor || "#ffffff"
  };
}

async function uploadLogo(dataUrl) {
  const result = await api("/api/uploads/team-logo", {
    method: "POST",
    body: JSON.stringify({ dataUrl })
  });
  return result.logoPath;
}

function createLogoDataUrl(file) {
  const mimeType = detectLogoMimeType(file);
  if (!mimeType) {
    return Promise.reject(new Error("PNGまたはJPEG画像を選択してください。"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error("画像を読み込めませんでした。")));
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("error", () => reject(new Error("画像を読み込めませんでした。")));
      image.addEventListener("load", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("画像を変換できませんでした。"));
          return;
        }
        if (mimeType === "image/jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(mimeType === "image/png" ? "image/png" : "image/jpeg", 0.86));
      });
      image.src = String(reader.result || "");
    });
    reader.readAsDataURL(file);
  });
}

function detectLogoMimeType(file) {
  if (["image/png", "image/jpeg"].includes(file.type)) return file.type;
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}
