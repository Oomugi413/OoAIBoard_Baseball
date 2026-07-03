// @ts-check
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
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
  const [dragState, setDragState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const orderedIdsRef = useRef(orderedIds);
  const flipBeforeRef = useRef(null);

  useEffect(() => {
    setOrderedIds((current) => {
      const next = mergeOrder(current, state.presets || []);
      orderedIdsRef.current = next;
      return next;
    });
  }, [state.presets]);

  const presetsById = new Map((state.presets || []).map((preset) => [preset.id, preset]));
  const orderedPresets = orderedIds.map((id) => presetsById.get(id)).filter(Boolean);
  const draggingId = dragState?.presetId || "";
  const floatingPreset = draggingId ? presetsById.get(draggingId) : null;

  useLayoutEffect(() => {
    if (!flipBeforeRef.current || !listRef.current) return;
    const before = flipBeforeRef.current;
    flipBeforeRef.current = null;
    animateListReorder(listRef.current, before);
  }, [orderedIds]);

  const startDrag = (event, presetId) => {
    const item = event.currentTarget.closest("[data-preset-reorder-item]");
    if (!item) return;
    const rect = item.getBoundingClientRect();
    setDragState({
      presetId,
      pointerId: event.pointerId,
      pointerY: event.clientY,
      offsetY: event.clientY - rect.top,
      left: rect.left,
      width: rect.width
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!dragState || !listRef.current) return;
    setDragState((current) => current ? { ...current, pointerY: event.clientY } : current);
    const placement = getTargetPlacement(listRef.current, event.clientY, draggingId);
    if (!placement || placement.targetId === draggingId) return;
    flipBeforeRef.current = measureItemTops(listRef.current);
    setOrderedIds((current) => {
      const next = moveToPlacement(current, draggingId, placement);
      orderedIdsRef.current = next;
      return next;
    });
  };

  const finishDrag = async (event) => {
    if (!dragState) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    const nextIds = orderedIdsRef.current;
    setDragState(null);
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
          <Stack ref={listRef} spacing={1.25} data-preset-reorder-list sx={{ position: "relative" }}>
            {orderedPresets.length ? (
              orderedPresets.map((preset, index) => (
                <Card
                  key={preset.id}
                  variant="outlined"
                  data-preset-reorder-item={preset.id}
                  sx={{
                    opacity: draggingId === preset.id ? 0.18 : 1,
                    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.08)",
                    borderColor: draggingId === preset.id ? "transparent" : "divider",
                    bgcolor: "background.paper",
                    borderRadius: 3,
                    touchAction: "none",
                    transition: "box-shadow 180ms ease, opacity 140ms ease, border-color 160ms ease",
                    willChange: "transform"
                  }}
                >
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <IconButton
                        disabled={saving}
                        onPointerDown={(event) => startDrag(event, preset.id)}
                        onPointerMove={moveDrag}
                        onPointerUp={finishDrag}
                        onPointerCancel={finishDrag}
                        data-drag-preset={preset.id}
                        aria-label={`${preset.presetName || "Team Preset"}を並べ替え`}
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 3,
                          cursor: draggingId === preset.id ? "grabbing" : "grab",
                          touchAction: "none",
                          color: "text.secondary"
                        }}
                      >
                        <DragHandleLines />
                      </IconButton>
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
          {floatingPreset && dragState ? (
            <Card
              variant="outlined"
              sx={{
                position: "fixed",
                left: `${dragState.left}px`,
                top: `${dragState.pointerY - dragState.offsetY}px`,
                width: `${dragState.width}px`,
                zIndex: 1400,
                pointerEvents: "none",
                borderRadius: 3,
                borderColor: "primary.main",
                bgcolor: "background.paper",
                boxShadow: "0 22px 44px rgba(15, 23, 42, 0.32)",
                transform: "scale(1.025)",
                transition: "box-shadow 140ms ease, transform 140ms ease"
              }}
            >
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      display: "grid",
                      placeItems: "center",
                      color: "text.secondary"
                    }}
                  >
                    <DragHandleLines />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight="bold" noWrap>
                      {orderedIds.indexOf(floatingPreset.id) + 1}. {floatingPreset.presetName || "Team Preset"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {floatingPreset.abbreviation || floatingPreset.name} / {floatingPreset.name || ""}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ) : null}
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

function DragHandleLines() {
  return (
    <Box sx={{ width: 24, display: "grid", gap: "4px" }} aria-hidden="true">
      {[0, 1, 2].map((line) => (
        <Box
          key={line}
          component="span"
          sx={{
            display: "block",
            height: 2,
            borderRadius: 999,
            bgcolor: "currentColor"
          }}
        />
      ))}
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

function measureItemTops(list) {
  const result = new Map();
  for (const item of list.querySelectorAll("[data-preset-reorder-item]")) {
    result.set(item.dataset.presetReorderItem || "", item.getBoundingClientRect().top);
  }
  return result;
}

function animateListReorder(list, before) {
  for (const item of list.querySelectorAll("[data-preset-reorder-item]")) {
    const id = item.dataset.presetReorderItem || "";
    const previousTop = before.get(id);
    if (previousTop === undefined) continue;
    const currentTop = item.getBoundingClientRect().top;
    const delta = previousTop - currentTop;
    if (!delta) continue;
    if (typeof item.animate !== "function") continue;
    item.animate(
      [
        { transform: `translateY(${delta}px)` },
        { transform: "translateY(0)" }
      ],
      {
        duration: 190,
        easing: "cubic-bezier(0.2, 0, 0, 1)"
      }
    );
  }
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
