// @ts-check
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api } from "../../api/client.js";
import { createTeamLogoDataUrl, uploadTeamLogo } from "../../utils/teamLogo.js";

const SIDES = ["away", "home"];
const SIDE_LABELS = { away: "先攻", home: "後攻" };
const MIN_ABBREVIATION_SCALE = 60;
const MAX_ABBREVIATION_SCALE = 180;
const MIN_ABBREVIATION_WIDTH = 30;
const MAX_ABBREVIATION_WIDTH = 120;

/**
 * @param {{
 *   open: boolean,
 *   board: any,
 *   presets: Array<any>,
 *   onClose: () => void,
 *   onSaved: (message: string) => void,
 *   onError: (message: string) => void,
 *   refresh: () => Promise<void>
 * }} props
 */
export default function EditMenu({ open, board, presets, onClose, onSaved, onError, refresh }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => createEditForm(board));
  const dirtyFieldsRef = useRef(new Set());

  const updateField = (field, value) => {
    dirtyFieldsRef.current.add(`field:${field}`);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateTeam = (side, field, value) => {
    dirtyFieldsRef.current.add(`team:${side}:${field}`);
    setForm((current) => ({
      ...current,
      teams: {
        ...current.teams,
        [side]: {
          ...current.teams[side],
          [field]: value
        }
      }
    }));
  };

  const handleLogoFile = async (side, file) => {
    if (!file) return;
    try {
      const dataUrl = await createTeamLogoDataUrl(file);
      updateTeam(side, "logoPath", "");
      updateTeam(side, "pendingLogo", dataUrl);
    } catch (error) {
      onError(error.message);
    }
  };

  const clearLogo = (side) => {
    updateTeam(side, "logoPath", "");
    updateTeam(side, "pendingLogo", "");
  };

  const loadPreset = (side) => {
    const presetId = form.teams[side].selectedPresetId;
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    markTeamFieldsDirty(dirtyFieldsRef.current, side, [
      "name",
      "abbreviation",
      "teamColor",
      "textColor",
      "logoPath",
      "pendingLogo",
      "linkedPresetId",
      "abbreviationWidth"
    ]);
    setForm((current) => ({
      ...current,
      teams: {
        ...current.teams,
        [side]: {
          ...current.teams[side],
          name: preset.name || "",
          abbreviation: preset.abbreviation || "",
          teamColor: preset.teamColor || "#1f5fbf",
          textColor: preset.textColor || "#ffffff",
          abbreviationWidth: clampNumber(preset.abbreviationWidth, MIN_ABBREVIATION_WIDTH, MAX_ABBREVIATION_WIDTH, 100),
          logoPath: preset.logoPath || "",
          pendingLogo: "",
          linkedPresetId: preset.id,
          selectedPresetId: preset.id
        }
      }
    }));
  };

  const saveTeamPreset = async (side) => {
    setSaving(true);
    try {
      const team = await resolveTeamForSave(form.teams[side]);
      const preset = await api("/api/presets", {
        method: "POST",
        body: JSON.stringify({
          presetName: team.name || team.abbreviation || "Team Preset",
          name: team.name,
          abbreviation: team.abbreviation,
          logoPath: team.logoPath,
          teamColor: team.teamColor,
          textColor: team.textColor,
          abbreviationWidth: team.abbreviationWidth
        })
      });
      updateTeam(side, "linkedPresetId", preset.id);
      updateTeam(side, "selectedPresetId", preset.id);
      updateTeam(side, "logoPath", team.logoPath);
      updateTeam(side, "pendingLogo", "");
      await refresh();
      onSaved("チームプリセットを保存しました。");
    } catch (error) {
      onError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEditMenu = async () => {
    setSaving(true);
    try {
      const patch = await createEditPatch(form, dirtyFieldsRef.current);
      if (!hasPatchContent(patch)) {
        onSaved("保存する変更はありません。");
        return;
      }

      const saved = await api(`/api/boards/${encodeURIComponent(board.id)}/action`, {
        method: "POST",
        body: JSON.stringify({ type: "board:patchConfig", payload: patch })
      });
      dirtyFieldsRef.current = new Set();
      setForm((current) => ({
        ...current,
        boardName: saved.name || current.boardName,
        showAbs: Boolean(saved.displayOptions?.showAbs),
        showMatchup: Boolean(saved.displayOptions?.showMatchup),
        teams: SIDES.reduce((teams, side) => ({
          ...teams,
          [side]: createTeamForm(saved.teamSettings?.[side] || current.teams[side])
        }), {})
      }));
      await refresh();
      onSaved("編集メニューを保存しました。");
    } catch (error) {
      onError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 440 }, maxWidth: "100%" } }}
    >
      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="h6" component="h2">
              編集メニュー
            </Typography>
            <Button onClick={onClose}>閉じる</Button>
          </Stack>
          <TextField
            label="スコアボード名"
            value={form.boardName}
            onChange={(event) => updateField("boardName", event.target.value)}
            fullWidth
          />
          {SIDES.map((side) => (
            <TeamSection
              key={side}
              side={side}
              team={form.teams[side]}
              presets={presets}
              saving={saving}
              onUpdate={updateTeam}
              onLogoFile={handleLogoFile}
              onClearLogo={clearLogo}
              onLoadPreset={loadPreset}
              onSavePreset={saveTeamPreset}
            />
          ))}
          <Divider />
          <FormControlLabel
            control={
              <Switch
                checked={form.showAbs}
                onChange={(event) => updateField("showAbs", event.target.checked)}
              />
            }
            label="ABS表示"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.showMatchup}
                onChange={(event) => updateField("showMatchup", event.target.checked)}
              />
            }
            label="対戦選手表示"
          />
          <Button variant="contained" disabled={saving} onClick={saveEditMenu}>
            編集内容を保存
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}

function TeamSection({
  side,
  team,
  presets,
  saving,
  onUpdate,
  onLogoFile,
  onClearLogo,
  onLoadPreset,
  onSavePreset
}) {
  const preview = team.pendingLogo || team.logoPath;
  const abbreviationScale = clampNumber(
    team.abbreviationScale,
    MIN_ABBREVIATION_SCALE,
    MAX_ABBREVIATION_SCALE,
    100
  );
  const abbreviationWidth = clampNumber(
    team.abbreviationWidth,
    MIN_ABBREVIATION_WIDTH,
    MAX_ABBREVIATION_WIDTH,
    100
  );
  return (
    <Box component="section" sx={{ display: "grid", gap: 1.5 }}>
      <Divider />
      <Typography variant="subtitle1" fontWeight="bold">
        {SIDE_LABELS[side]}
      </Typography>
      <TextField
        label="チーム名"
        value={team.name}
        onChange={(event) => onUpdate(side, "name", event.target.value)}
      />
      <TextField
        label="略称"
        value={team.abbreviation}
        onChange={(event) => onUpdate(side, "abbreviation", event.target.value)}
      />
      <Stack spacing={0.5}>
        <Typography variant="body2">略称拡大率 {abbreviationScale}%</Typography>
        <Slider
          value={abbreviationScale}
          min={MIN_ABBREVIATION_SCALE}
          max={MAX_ABBREVIATION_SCALE}
          step={5}
          marks={[
            { value: MIN_ABBREVIATION_SCALE, label: "60%" },
            { value: 100, label: "100%" },
            { value: MAX_ABBREVIATION_SCALE, label: "180%" }
          ]}
          onChange={(_, value) => onUpdate(side, "abbreviationScale", Array.isArray(value) ? value[0] : value)}
        />
        <NumberApplyField
          label="略称拡大率(%)"
          value={abbreviationScale}
          min={MIN_ABBREVIATION_SCALE}
          max={MAX_ABBREVIATION_SCALE}
          onApply={(value) => onUpdate(side, "abbreviationScale", value)}
        />
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="body2">略称圧縮 {abbreviationWidth}%</Typography>
        <Slider
          value={abbreviationWidth}
          min={MIN_ABBREVIATION_WIDTH}
          max={MAX_ABBREVIATION_WIDTH}
          step={5}
          marks={[
            { value: MIN_ABBREVIATION_WIDTH, label: "30%" },
            { value: 100, label: "100%" },
            { value: MAX_ABBREVIATION_WIDTH, label: "120%" }
          ]}
          onChange={(_, value) => onUpdate(side, "abbreviationWidth", Array.isArray(value) ? value[0] : value)}
        />
        <NumberApplyField
          label="略称圧縮(%)"
          value={abbreviationWidth}
          min={MIN_ABBREVIATION_WIDTH}
          max={MAX_ABBREVIATION_WIDTH}
          onApply={(value) => onUpdate(side, "abbreviationWidth", value)}
        />
      </Stack>
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(team.abbreviationCentered)}
            onChange={(event) => onUpdate(side, "abbreviationCentered", event.target.checked)}
          />
        }
        label="略称中央揃え"
      />
      <Stack direction="row" spacing={1}>
        <TextField
          label="チーム色"
          type="color"
          value={team.teamColor}
          onChange={(event) => onUpdate(side, "teamColor", event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          label="文字色"
          type="color"
          value={team.textColor}
          onChange={(event) => onUpdate(side, "textColor", event.target.value)}
          sx={{ flex: 1 }}
        />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button component="label" variant="outlined">
          ロゴ画像
          <input
            hidden
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => onLogoFile(side, event.target.files?.[0] || null)}
          />
        </Button>
        <Button onClick={() => onClearLogo(side)}>ロゴ削除</Button>
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
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel id={`${side}-preset-label`}>プリセット</InputLabel>
          <Select
            labelId={`${side}-preset-label`}
            label="プリセット"
            value={team.selectedPresetId}
            onChange={(event) => onUpdate(side, "selectedPresetId", event.target.value)}
          >
            <MenuItem value="">プリセットを選択</MenuItem>
            {presets.map((preset) => (
              <MenuItem key={preset.id} value={preset.id}>
                {preset.presetName || preset.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button disabled={saving || !team.selectedPresetId} onClick={() => onLoadPreset(side)}>
          読込
        </Button>
        <Button disabled={saving} onClick={() => onSavePreset(side)}>
          プリセット保存
        </Button>
      </Stack>
    </Box>
  );
}

function NumberApplyField({ label, value, min, max, onApply }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const apply = () => {
    onApply(clampNumber(draft, min, max, value));
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        label={label}
        type="text"
        value={draft}
        inputProps={{ inputMode: "numeric" }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
        }}
        sx={{ flex: 1 }}
      />
      <Button variant="outlined" onClick={apply}>
        反映
      </Button>
    </Stack>
  );
}

function createEditForm(board) {
  return {
    boardName: board.name || "",
    showAbs: Boolean(board.displayOptions?.showAbs),
    showMatchup: Boolean(board.displayOptions?.showMatchup),
    teams: {
      away: createTeamForm(board.teamSettings.away),
      home: createTeamForm(board.teamSettings.home)
    }
  };
}

function createTeamForm(team) {
  return {
    name: team.name || "",
    abbreviation: team.abbreviation || "",
    logoPath: team.logoPath || "",
    pendingLogo: "",
    teamColor: team.teamColor || "#1f5fbf",
    textColor: team.textColor || "#ffffff",
    linkedPresetId: team.linkedPresetId || "",
    selectedPresetId: team.linkedPresetId || "",
    abbreviationScale: clampNumber(team.abbreviationScale, MIN_ABBREVIATION_SCALE, MAX_ABBREVIATION_SCALE, 100),
    abbreviationWidth: clampNumber(team.abbreviationWidth, MIN_ABBREVIATION_WIDTH, MAX_ABBREVIATION_WIDTH, 100),
    abbreviationCentered: Boolean(team.abbreviationCentered)
  };
}

async function createEditPatch(form, dirtyFields) {
  const patch = {};
  if (dirtyFields.has("field:boardName")) {
    patch.name = form.boardName;
  }

  const teams = {};
  for (const side of SIDES) {
    const values = await createTeamPatch(form.teams[side], dirtyFields, side);
    if (Object.keys(values).length) teams[side] = values;
  }
  if (Object.keys(teams).length) patch.teams = teams;

  const displayOptions = {};
  if (dirtyFields.has("field:showAbs")) displayOptions.showAbs = form.showAbs;
  if (dirtyFields.has("field:showMatchup")) displayOptions.showMatchup = form.showMatchup;
  if (Object.keys(displayOptions).length) patch.displayOptions = displayOptions;

  return patch;
}

async function createTeamPatch(team, dirtyFields, side) {
  const values = {};
  const fieldKeys = ["name", "abbreviation", "teamColor", "textColor", "linkedPresetId", "abbreviationScale", "abbreviationWidth", "abbreviationCentered"];
  for (const field of fieldKeys) {
    if (dirtyFields.has(`team:${side}:${field}`)) {
      if (field === "abbreviationScale") {
        values[field] = clampNumber(team[field], MIN_ABBREVIATION_SCALE, MAX_ABBREVIATION_SCALE, 100);
      } else if (field === "abbreviationWidth") {
        values[field] = clampNumber(team[field], MIN_ABBREVIATION_WIDTH, MAX_ABBREVIATION_WIDTH, 100);
      } else if (field === "abbreviationCentered") {
        values[field] = Boolean(team[field]);
      } else {
        values[field] = team[field];
      }
    }
  }
  if (dirtyFields.has(`team:${side}:pendingLogo`)) {
    values.logoPath = team.pendingLogo ? await uploadTeamLogo(team.pendingLogo) : team.logoPath;
  } else if (dirtyFields.has(`team:${side}:logoPath`)) {
    values.logoPath = team.logoPath;
  }
  return values;
}

function hasPatchContent(patch) {
  return Boolean(
    Object.hasOwn(patch, "name") ||
    Object.keys(patch.teams || {}).length ||
    Object.keys(patch.displayOptions || {}).length
  );
}

function markTeamFieldsDirty(target, side, fields) {
  for (const field of fields) {
    target.add(`team:${side}:${field}`);
  }
}

async function resolveTeamForSave(team) {
  const logoPath = team.pendingLogo ? await uploadTeamLogo(team.pendingLogo) : team.logoPath;
  return {
    name: team.name,
    abbreviation: team.abbreviation,
    teamColor: team.teamColor,
    textColor: team.textColor,
    logoPath,
    linkedPresetId: team.linkedPresetId || null,
    abbreviationScale: clampNumber(team.abbreviationScale, MIN_ABBREVIATION_SCALE, MAX_ABBREVIATION_SCALE, 100),
    abbreviationWidth: clampNumber(team.abbreviationWidth, MIN_ABBREVIATION_WIDTH, MAX_ABBREVIATION_WIDTH, 100),
    abbreviationCentered: Boolean(team.abbreviationCentered)
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
