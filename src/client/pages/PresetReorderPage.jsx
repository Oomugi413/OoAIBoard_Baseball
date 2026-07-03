// @ts-check
import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client.js";
import { useServerState } from "../api/useServerState.js";
import TopBar from "../components/common/TopBar.jsx";

export default function PresetReorderPage() {
  const { state, refresh } = useServerState();
  const [orderedIds, setOrderedIds] = useState(() => (state.presets || []).map((preset) => preset.id));
  const [draggingId, setDraggingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const orderedIdsRef = useRef(orderedIds);

  useEffect(() => {
    setOrderedIds((current) => {
      const next = mergeOrder(current, state.presets || []);
      orderedIdsRef.current = next;
      return next;
    });
  }, [state.presets]);

  const presetsById = new Map((state.presets || []).map((preset) => [preset.id, preset]));
  const orderedPresets = orderedIds.map((id) => presetsById.get(id)).filter(Boolean);

  const startDrag = (event, presetId) => {
    setDraggingId(presetId);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!draggingId || !listRef.current) return;
    const placement = getTargetPlacement(listRef.current, event.clientY, draggingId);
    if (!placement || placement.targetId === draggingId) return;
    setOrderedIds((current) => {
      const next = moveToPlacement(current, draggingId, placement);
      orderedIdsRef.current = next;
      return next;
    });
  };

  const finishDrag = async (event) => {
    if (!draggingId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const nextIds = orderedIdsRef.current;
    setDraggingId("");
    await saveOrder(nextIds);
  };

  const saveOrder = async (presetIds) => {
    if (!presetIds.length) return;
    setSaving(true);
    try {
      await api("/api/presets/order", {
        method: "PATCH",
        body: JSON.stringify({ presetIds })
      });
      await refresh();
      setMessage("プリセットの順番を保存しました。");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <TopBar title="プリセット並べ替え" />
      <Box component="main" sx={{ p: 2, maxWidth: 760, mx: "auto" }}>
        <Stack spacing={2}>
          {error ? (
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          ) : null}
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
            <Button component={RouterLink} to="/settings">
              設定に戻る
            </Button>
            <Typography variant="body2" color="text.secondary">
              {saving ? "保存中" : "ドラッグで並べ替え"}
            </Typography>
          </Stack>
          <Stack ref={listRef} spacing={1.25} data-preset-reorder-list>
            {orderedPresets.length ? (
              orderedPresets.map((preset, index) => (
                <Card
                  key={preset.id}
                  variant="outlined"
                  data-preset-reorder-item={preset.id}
                  sx={{
                    opacity: draggingId && draggingId !== preset.id ? 0.82 : 1,
                    boxShadow: draggingId === preset.id ? "0 18px 38px rgba(15, 23, 42, 0.28)" : "0 2px 10px rgba(15, 23, 42, 0.08)",
                    borderColor: draggingId === preset.id ? "primary.main" : "divider",
                    bgcolor: draggingId === preset.id ? "rgba(25, 118, 210, 0.08)" : "background.paper",
                    borderRadius: 3,
                    touchAction: "none",
                    transform: draggingId === preset.id ? "scale(1.018)" : "scale(1)",
                    transition: "transform 160ms ease, box-shadow 160ms ease, opacity 140ms ease, border-color 160ms ease",
                    willChange: "transform"
                  }}
                >
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Button
                        variant="outlined"
                        disabled={saving}
                        onPointerDown={(event) => startDrag(event, preset.id)}
                        onPointerMove={moveDrag}
                        onPointerUp={finishDrag}
                        onPointerCancel={finishDrag}
                        data-drag-preset={preset.id}
                        aria-label={`${preset.presetName || "Team Preset"}を並べ替え`}
                        sx={{
                          minWidth: 56,
                          width: 56,
                          height: 56,
                          borderRadius: 2.5,
                          cursor: draggingId === preset.id ? "grabbing" : "grab",
                          touchAction: "none",
                          fontSize: 22,
                          lineHeight: 1,
                          px: 0
                        }}
                      >
                        ⋮⋮
                      </Button>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight="bold" noWrap>
                          {index + 1}. {preset.presetName || "Team Preset"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {preset.abbreviation || preset.name} / {preset.name || ""}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Alert severity="info">チームプリセットがありません。</Alert>
            )}
          </Stack>
        </Stack>
      </Box>
      <Snackbar
        open={Boolean(message)}
        autoHideDuration={3000}
        onClose={() => setMessage("")}
        message={message}
      />
    </Box>
  );
}

function mergeOrder(current, presets) {
  const ids = presets.map((preset) => preset.id);
  const existing = current.filter((id) => ids.includes(id));
  const added = ids.filter((id) => !existing.includes(id));
  return [...existing, ...added];
}

function getTargetPlacement(list, clientY, draggingId) {
  const items = Array.from(list.querySelectorAll("[data-preset-reorder-item]"))
    .filter((item) => item.dataset.presetReorderItem !== draggingId);
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return { targetId: item.dataset.presetReorderItem || "", before: true };
    }
  }
  const last = items.at(-1)?.dataset.presetReorderItem || "";
  return last ? { targetId: last, before: false } : null;
}

function moveToPlacement(ids, movingId, placement) {
  const withoutMoving = ids.filter((id) => id !== movingId);
  const targetIndex = withoutMoving.indexOf(placement.targetId);
  if (targetIndex === -1) return ids;
  const insertIndex = placement.before ? targetIndex : targetIndex + 1;
  return [
    ...withoutMoving.slice(0, insertIndex),
    movingId,
    ...withoutMoving.slice(insertIndex)
  ];
}
