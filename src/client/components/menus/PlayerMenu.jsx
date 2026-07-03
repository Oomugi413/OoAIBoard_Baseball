// @ts-check
import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api } from "../../api/client.js";

const SIDES = ["away", "home"];
const SIDE_LABELS = { away: "先攻", home: "後攻" };

/**
 * @param {{
 *   open: boolean,
 *   board: any,
 *   onClose: () => void,
 *   onSaved: (message: string) => void,
 *   onError: (message: string) => void,
 *   refresh: () => Promise<void>
 * }} props
 */
export default function PlayerMenu({ open, board, onClose, onSaved, onError, refresh }) {
  const [saving, setSaving] = useState(false);
  const [activeSide, setActiveSide] = useState("away");
  const [form, setForm] = useState(() => createPlayerForm(board));
  const dirtyFieldsRef = useRef(new Set());
  const addedPitchersRef = useRef({ away: 0, home: 0 });
  const initialPitcherLengthsRef = useRef(createInitialPitcherLengths(board));

  const updateBatter = (side, index, field, value) => {
    dirtyFieldsRef.current.add(`batter:${side}:${index}:${field}`);
    setForm((current) => ({
      ...current,
      [side]: {
        ...current[side],
        battingOrder: current[side].battingOrder.map((player, playerIndex) =>
          playerIndex === index ? { ...player, [field]: value } : player
        )
      }
    }));
  };

  const updatePitcher = (side, index, field, value) => {
    dirtyFieldsRef.current.add(`pitcher:${side}:${index}:${field}`);
    setForm((current) => ({
      ...current,
      [side]: {
        ...current[side],
        pitchers: current[side].pitchers.map((pitcher, pitcherIndex) =>
          pitcherIndex === index ? { ...pitcher, [field]: value } : pitcher
        )
      }
    }));
  };

  const addPitcher = (side) => {
    addedPitchersRef.current[side] += 1;
    setForm((current) => {
      const pitchers = current[side].pitchers;
      const order = pitchers.length + 1;
      return {
        ...current,
        [side]: {
          ...current[side],
          pitchers: [
            ...pitchers,
            {
              pitcherName: defaultPitcherName(side, order),
              pitchCount: 0,
              order
            }
          ]
        }
      };
    });
  };

  const savePlayerMenu = async () => {
    setSaving(true);
    try {
      await api(`/api/boards/${encodeURIComponent(board.id)}/action`, {
        method: "POST",
        body: JSON.stringify({
          type: "players:patch",
          payload: createPatchPayload(
            form,
            dirtyFieldsRef.current,
            addedPitchersRef.current,
            initialPitcherLengthsRef.current
          )
        })
      });
      await refresh();
      onSaved("選手名メニューを保存しました。");
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
      PaperProps={{ sx: { width: { xs: "100%", sm: 560 }, maxWidth: "100%" } }}
    >
      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="h6" component="h2">
              選手名メニュー
            </Typography>
            <Button onClick={onClose}>閉じる</Button>
          </Stack>
          <Tabs
            value={activeSide}
            onChange={(_, value) => setActiveSide(value)}
            variant="fullWidth"
          >
            {SIDES.map((side) => (
              <Tab key={side} value={side} label={SIDE_LABELS[side]} />
            ))}
          </Tabs>
          <PlayerSideSection
            side={activeSide}
            sideForm={form[activeSide]}
            saving={saving}
            onBatterChange={updateBatter}
            onPitcherChange={updatePitcher}
            onAddPitcher={addPitcher}
          />
          <Button
            variant="contained"
            disabled={saving}
            onClick={savePlayerMenu}
            data-save-player-menu
          >
            編集内容を保存
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}

function PlayerSideSection({
  side,
  sideForm,
  saving,
  onBatterChange,
  onPitcherChange,
  onAddPitcher
}) {
  return (
    <Stack spacing={2}>
      <Box component="section">
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
          打者 1-9番
        </Typography>
        <Stack spacing={1}>
          {sideForm.battingOrder.map((player, index) => (
            <Stack
              key={`${side}-batter-${index}`}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
            >
              <Typography sx={{ width: { sm: 40 }, fontWeight: "bold" }}>
                {index + 1}
              </Typography>
              <TextField
                label="選手名"
                value={player.playerName}
                onChange={(event) => onBatterChange(side, index, "playerName", event.target.value)}
                slotProps={{ htmlInput: { "data-player-field": `${side}:${index}:name` } }}
                fullWidth
              />
              <TextField
                label="守備位置"
                value={player.position}
                onChange={(event) => onBatterChange(side, index, "position", event.target.value)}
                slotProps={{ htmlInput: { "data-player-field": `${side}:${index}:position` } }}
                sx={{ width: { sm: 120 } }}
              />
              <FormControlLabel
                sx={{ minWidth: 88 }}
                control={
                  <Checkbox
                    checked={player.isPinchHitter}
                    onChange={(event) => onBatterChange(side, index, "isPinchHitter", event.target.checked)}
                    slotProps={{ input: { "data-player-field": `${side}:${index}:ph` } }}
                  />
                }
                label="PH"
              />
            </Stack>
          ))}
        </Stack>
      </Box>
      <Divider />
      <Box component="section">
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            ピッチャー一覧
          </Typography>
          <Button
            variant="outlined"
            disabled={saving}
            onClick={() => onAddPitcher(side)}
            data-add-pitcher={side}
          >
            ピッチャー追加
          </Button>
        </Stack>
        <Stack spacing={1}>
          {sideForm.pitchers.map((pitcher, index) => (
            <Stack
              key={`${side}-pitcher-${index}`}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
            >
              <Typography sx={{ width: { sm: 48 }, fontWeight: "bold" }}>
                {index === sideForm.pitchers.length - 1 ? "現在" : index + 1}
              </Typography>
              <TextField
                label="ピッチャー名"
                value={pitcher.pitcherName}
                onChange={(event) => onPitcherChange(side, index, "pitcherName", event.target.value)}
                slotProps={{ htmlInput: { "data-pitcher-field": `${side}:${index}:name` } }}
                fullWidth
              />
              <TextField
                label="球数"
                type="number"
                value={pitcher.pitchCount}
                slotProps={{ htmlInput: { min: 0, "data-pitcher-field": `${side}:${index}:pitchCount` } }}
                onChange={(event) =>
                  onPitcherChange(side, index, "pitchCount", Math.max(0, Number(event.target.value || 0)))
                }
                sx={{ width: { sm: 120 } }}
              />
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function createPlayerForm(board) {
  const source = board.playerSettings || {};
  return {
    matchupEnabled: source.matchupEnabled !== false,
    currentBattingOrderIndex: {
      away: clampBattingIndex(source.currentBattingOrderIndex?.away),
      home: clampBattingIndex(source.currentBattingOrderIndex?.home)
    },
    away: createSideForm(source.away, "away"),
    home: createSideForm(source.home, "home")
  };
}

function createSideForm(sideSettings, side) {
  return {
    battingOrder: normalizeBattingOrder(sideSettings?.battingOrder, side),
    pitchers: normalizePitchers(sideSettings?.pitchers, side)
  };
}

function normalizeBattingOrder(players, side) {
  const label = side === "away" ? "A" : "B";
  return Array.from({ length: 9 }, (_, index) => {
    const player = Array.isArray(players) ? players[index] : null;
    return {
      battingOrderNumber: Number(player?.battingOrderNumber) || index + 1,
      playerName: String(player?.playerName || `${label}.Batter${index + 1}`),
      position: String(player?.position || ""),
      isPinchHitter: Boolean(player?.isPinchHitter),
      homeRuns: Number(player?.homeRuns || 0),
      hits: Number(player?.hits || 0),
      strikeoutsSwinging: Number(player?.strikeoutsSwinging || 0),
      strikeoutsLooking: Number(player?.strikeoutsLooking || 0),
      outs: Number(player?.outs || 0),
      others: Number(player?.others || 0)
    };
  });
}

function normalizePitchers(pitchers, side) {
  const normalized = (Array.isArray(pitchers) ? pitchers : [])
    .map((pitcher, index) => ({
      pitcherName: String(pitcher?.pitcherName || defaultPitcherName(side, index + 1)),
      pitchCount: Math.max(0, Number(pitcher?.pitchCount || 0)),
      order: Number.isFinite(Number(pitcher?.order)) ? Number(pitcher.order) : index + 1
    }));
  return normalized.length ? normalized : [{ pitcherName: defaultPitcherName(side, 1), pitchCount: 0, order: 1 }];
}

function createPatchPayload(form, dirtyFields, addedPitchers, initialPitcherLengths) {
  const payload = {
    battingOrderUpdates: { away: {}, home: {} },
    pitcherUpdates: { away: {}, home: {} },
    addedPitchers: { away: [], home: [] }
  };

  for (const key of dirtyFields) {
    const [kind, side, rawIndex, field] = key.split(":");
    const index = Number(rawIndex);
    if (!SIDES.includes(side) || !Number.isInteger(index)) continue;
    if (kind === "batter") {
      const player = form[side]?.battingOrder?.[index];
      if (!player) continue;
      payload.battingOrderUpdates[side][index] = {
        ...(payload.battingOrderUpdates[side][index] || {}),
        [field]: player[field]
      };
    }
    if (kind === "pitcher" && index < initialPitcherLengths[side]) {
      const pitcher = form[side]?.pitchers?.[index];
      if (!pitcher) continue;
      payload.pitcherUpdates[side][index] = {
        ...(payload.pitcherUpdates[side][index] || {}),
        [field]: field === "pitchCount" ? Math.max(0, Number(pitcher.pitchCount || 0)) : pitcher[field]
      };
    }
  }

  for (const side of SIDES) {
    const start = initialPitcherLengths[side];
    const count = addedPitchers[side] || 0;
    payload.addedPitchers[side] = form[side].pitchers
      .slice(start, start + count)
      .map((pitcher) => ({
        pitcherName: String(pitcher.pitcherName || defaultPitcherName(side, 1)),
        pitchCount: Math.max(0, Number(pitcher.pitchCount || 0))
      }));
  }

  return payload;
}

function createInitialPitcherLengths(board) {
  return {
    away: Math.max(1, board.playerSettings?.away?.pitchers?.length || 0),
    home: Math.max(1, board.playerSettings?.home?.pitchers?.length || 0)
  };
}

function defaultPitcherName(side, order) {
  return `${side === "away" ? "A" : "B"}.Pitcher${order}`;
}

function clampBattingIndex(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) return 0;
  return Math.max(0, Math.min(8, number));
}
