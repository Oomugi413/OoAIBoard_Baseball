// @ts-check
import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Slider from "@mui/material/Slider";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useServerState } from "../api/useServerState.js";
import TopBar from "../components/common/TopBar.jsx";
import ScoreboardView from "../components/scoreboard/ScoreboardView.jsx";
import {
  BOARD_ASPECT_RATIO,
  DEFAULT_BOARD_WIDTH,
  MAX_BOARD_SCALE,
  MIN_BOARD_SCALE,
  boardSizeToScale,
  clampScale,
  defaultBoardTransform,
  getBoardTransform,
  getBoardZIndex,
  loadViewerSettings,
  resetBoardTransform,
  saveViewerSettings,
  scaleToBoardSize,
  setBoardTransform
} from "../viewer/viewerSettings.js";

const RESIZE_HANDLES = ["n", "e", "s", "w", "ne", "se", "sw", "nw"];
const COMPACT_BOARD_ASPECT_RATIO = 1200 / 362;

export default function ViewerPage() {
  const { state } = useServerState();
  const boards = state.boards || [];
  const [viewerSettings, setViewerSettings] = useState(() => loadViewerSettings());
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    setSelectedBoardId((current) => resolveSelectedBoardId(boards, current));
  }, [boards]);

  useEffect(() => {
    document.body.style.background = viewerSettings.backgroundColor;
    return () => {
      document.body.style.background = "";
    };
  }, [viewerSettings.backgroundColor]);

  const selectedTransform = selectedBoardId
    ? getBoardTransform(viewerSettings, selectedBoardId)
    : defaultBoardTransform(viewerSettings);

  const persistSettings = (next) => {
    const saved = saveViewerSettings(next);
    setViewerSettings(saved);
    return saved;
  };

  const updateBackground = (backgroundColor) => {
    persistSettings({ ...viewerSettings, backgroundColor });
  };

  const updateSelectedTransform = (next) => {
    if (!selectedBoardId) return;
    persistSettings(setBoardTransform(viewerSettings, selectedBoardId, next));
  };

  const resetSelected = () => {
    if (!selectedBoardId) return;
    persistSettings(resetBoardTransform(viewerSettings, selectedBoardId));
  };

  const exportSettings = async () => {
    const raw = JSON.stringify(viewerSettings, null, 2);
    try {
      await navigator.clipboard?.writeText(raw);
      setMessage("表示設定をクリップボードへ書き出しました。");
    } catch {
      setMessage(raw);
    }
  };

  const importSettingsFile = async (file) => {
    if (!file) return;
    try {
      const raw = await file.text();
      persistSettings(JSON.parse(raw));
      setMessage("表示設定を読み込みました。");
    } catch {
      setError("表示設定を読み込めませんでした。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: viewerSettings.backgroundColor }}>
      <TopBar title="スコアボードを見る" />
      <Box component="main" sx={{ minHeight: "calc(100vh - 64px)" }}>
        <ViewerToolbar
          boards={boards}
          selectedBoardId={selectedBoardId}
          selectedTransform={selectedTransform}
          backgroundColor={viewerSettings.backgroundColor}
          onBackground={updateBackground}
          onSelectBoard={setSelectedBoardId}
          onTransform={updateSelectedTransform}
          onReset={resetSelected}
          onExport={exportSettings}
          onImport={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => importSettingsFile(event.target.files?.[0] || null)}
        />
        <Box
          component="section"
          sx={{
            position: "relative",
            minHeight: "calc(100vh - 176px)",
            overflow: "hidden"
          }}
          data-viewer-stage
        >
          {boards.length ? (
            boards.map((board) => (
              <ViewerBoard
                key={board.id}
                board={board}
                selected={board.id === selectedBoardId}
                transform={getBoardTransform(viewerSettings, board.id)}
                zIndex={getBoardZIndex(viewerSettings, board.id)}
                onSelect={setSelectedBoardId}
                onTransform={(next) => persistSettings(setBoardTransform(viewerSettings, board.id, next))}
              />
            ))
          ) : (
            <Alert severity="info" sx={{ m: 2 }}>
              稼働中のスコアボードがありません。
            </Alert>
          )}
        </Box>
      </Box>
      {error ? (
        <Snackbar
          open={Boolean(error)}
          autoHideDuration={4000}
          onClose={() => setError("")}
          message={error}
        />
      ) : null}
      <Snackbar
        key={message}
        open={Boolean(message)}
        autoHideDuration={5000}
        onClose={() => setMessage("")}
        message={message}
      />
    </Box>
  );
}

function ViewerToolbar({
  boards,
  selectedBoardId,
  selectedTransform,
  backgroundColor,
  onBackground,
  onSelectBoard,
  onTransform,
  onReset,
  onExport,
  onImport
}) {
  const disabled = !boards.length;
  const scale = Math.round(selectedTransform.scale);
  return (
    <Box
      component="section"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "180px 220px minmax(220px, 1fr) 120px 120px 110px 110px auto" },
        gap: 1,
        alignItems: "center",
        p: 1.5,
        bgcolor: "rgba(244, 246, 248, 0.94)",
        borderBottom: "1px solid",
        borderColor: "divider"
      }}
    >
      <TextField
        label="背景色"
        type="color"
        value={backgroundColor}
        onChange={(event) => onBackground(event.target.value)}
        size="small"
        data-viewer-bg
      />
      <FormControl size="small" disabled={disabled}>
        <InputLabel id="viewer-board-select-label">位置対象</InputLabel>
        <Select
          labelId="viewer-board-select-label"
          label="位置対象"
          value={selectedBoardId}
          onChange={(event) => onSelectBoard(event.target.value)}
          data-viewer-board-select
        >
          {boards.map((board) => (
            <MenuItem key={board.id} value={board.id}>
              {board.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Stack spacing={0.5}>
        <Typography variant="body2">拡大率 {scale}%</Typography>
        <Slider
          disabled={disabled}
          min={MIN_BOARD_SCALE}
          max={MAX_BOARD_SCALE}
          value={scale}
          onChange={(_, value) => onTransform({ scale: Array.isArray(value) ? value[0] : value })}
          data-viewer-scale
        />
      </Stack>
      <LinkedNumberField
        label="拡大率(%)"
        disabled={disabled}
        value={scale}
        onCommit={(value) => onTransform({ scale: value })}
        inputProps={{ "data-viewer-scale-input": "" }}
      />
      <LinkedNumberField
        label="サイズ(px)"
        disabled={disabled}
        value={scaleToBoardSize(scale)}
        onCommit={(value) => onTransform({ scale: boardSizeToScale(value) })}
        inputProps={{ "data-viewer-size-input": "" }}
      />
      <LinkedNumberField
        label="位置X"
        disabled={disabled}
        value={Math.round(selectedTransform.x)}
        onCommit={(value) => onTransform({ x: value })}
        inputProps={{ "data-viewer-x": "" }}
      />
      <LinkedNumberField
        label="位置Y"
        disabled={disabled}
        value={Math.round(selectedTransform.y)}
        onCommit={(value) => onTransform({ y: value })}
        inputProps={{ "data-viewer-y": "" }}
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button disabled={disabled} onClick={onReset}>表示リセット</Button>
        <Button onClick={onExport}>書き出し</Button>
        <Button onClick={onImport}>読み込み</Button>
      </Stack>
    </Box>
  );
}

function LinkedNumberField({ label, disabled, value, onCommit, inputProps }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const lastCommittedRef = useRef(Number(value));

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
      lastCommittedRef.current = Number(value);
    }
  }, [focused, value]);

  useEffect(() => {
    if (!focused || draft.trim() === "") return undefined;
    const timeout = setTimeout(() => {
      commitNumber(draft, onCommit, lastCommittedRef);
    }, 250);
    return () => clearTimeout(timeout);
  }, [draft, focused, onCommit]);

  const commit = () => {
    commitNumber(draft, onCommit, lastCommittedRef);
    setFocused(false);
  };

  return (
    <TextField
      label={label}
      type="text"
      disabled={disabled}
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        event.target.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      size="small"
      slotProps={{ htmlInput: { inputMode: "numeric", ...inputProps } }}
    />
  );
}

function ViewerBoard({ board, selected, transform, zIndex, onSelect, onTransform }) {
  const pointerState = useRef(null);
  const visualWidth = scaleToBoardSize(transform.scale);
  const boardAspectRatio = board.displayOptions.showMatchup ? BOARD_ASPECT_RATIO : COMPACT_BOARD_ASPECT_RATIO;
  const visualHeight = visualWidth / boardAspectRatio;

  const startPointer = (event) => {
    if (event.button !== 0) return;
    const handle = event.target instanceof Element
      ? event.target.closest("[data-resize-handle]")?.dataset.resizeHandle || resolveResizeHandle(event)
      : "";
    pointerState.current = {
      boardId: board.id,
      handle,
      start: transform,
      startWidth: visualWidth,
      startRight: transform.x + visualWidth,
      startBottom: transform.y + visualHeight,
      aspectRatio: boardAspectRatio,
      pointerX: event.clientX,
      pointerY: event.clientY
    };
    event.preventDefault();
    onSelect(board.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePointer = (event) => {
    const current = pointerState.current;
    if (!current) return;
    const dx = event.clientX - current.pointerX;
    const dy = event.clientY - current.pointerY;
    if (current.handle) {
      onTransform(resizeTransformFromPointer(current.handle, current.start, current.startWidth, current.startRight, current.startBottom, current.aspectRatio, dx, dy));
    } else {
      onTransform({
        x: Math.round(current.start.x + dx),
        y: Math.round(current.start.y + dy),
        scale: current.start.scale
      });
    }
  };

  const endPointer = (event) => {
    pointerState.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be gone after a fast pointer sequence.
    }
  };

  return (
    <Box
      data-viewer-board={board.id}
      onPointerDown={startPointer}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      sx={{
        position: "absolute",
        left: `${transform.x}px`,
        top: `${transform.y}px`,
        width: `${visualWidth}px`,
        height: `${visualHeight}px`,
        zIndex,
        cursor: "move",
        touchAction: "none",
        outline: selected ? "2px solid rgba(56, 189, 248, 0.9)" : "none",
        outlineOffset: 3,
        "&:hover": { outline: selected ? "2px solid rgba(56, 189, 248, 0.9)" : "1px solid rgba(56, 189, 248, 0.55)" }
      }}
    >
      {RESIZE_HANDLES.map((handle) => (
        <Box
          key={handle}
          component="span"
          data-resize-handle={handle}
          sx={{
            position: "absolute",
            ...resizeHandleSx(handle),
            zIndex: 3,
            touchAction: "none"
          }}
        />
      ))}
      <Box sx={{ width: "100%", pointerEvents: "none", "& .scoreboard": { minWidth: 0 } }}>
        <ScoreboardView board={board} />
      </Box>
    </Box>
  );
}

function resolveSelectedBoardId(boards, currentId) {
  if (!boards.length) return "";
  if (currentId && boards.some((board) => board.id === currentId)) return currentId;
  return boards[0].id;
}

function resolveResizeHandle(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const edgeSize = 18;
  const nearLeft = event.clientX - rect.left <= edgeSize;
  const nearRight = rect.right - event.clientX <= edgeSize;
  const nearTop = event.clientY - rect.top <= edgeSize;
  const nearBottom = rect.bottom - event.clientY <= edgeSize;
  if (nearTop && nearLeft) return "nw";
  if (nearTop && nearRight) return "ne";
  if (nearBottom && nearLeft) return "sw";
  if (nearBottom && nearRight) return "se";
  if (nearTop) return "n";
  if (nearRight) return "e";
  if (nearBottom) return "s";
  if (nearLeft) return "w";
  return "";
}

function commitNumber(raw, onCommit, lastCommittedRef) {
  const number = Number(raw);
  if (!Number.isFinite(number) || number === lastCommittedRef.current) return;
  lastCommittedRef.current = number;
  onCommit(number);
}

function resizeTransformFromPointer(handle, start, startVisualWidth, startRight, startBottom, aspectRatio, dx, dy) {
  const horizontalDelta = handle.includes("e") ? dx : handle.includes("w") ? -dx : 0;
  const verticalDelta = handle.includes("s") ? dy * aspectRatio : handle.includes("n") ? -dy * aspectRatio : 0;
  const widthDelta = Math.abs(horizontalDelta) >= Math.abs(verticalDelta) ? horizontalDelta : verticalDelta;
  const scale = clampScale(((startVisualWidth + widthDelta) / DEFAULT_BOARD_WIDTH) * 100);
  const nextWidth = scaleToBoardSize(scale);
  const nextHeight = nextWidth / aspectRatio;
  return {
    x: handle.includes("w") ? Math.round(startRight - nextWidth) : start.x,
    y: handle.includes("n") ? Math.round(startBottom - nextHeight) : start.y,
    scale
  };
}

function resizeHandleSx(handle) {
  const size = 20;
  const offset = -10;
  const sx = { width: size, height: size };
  if (handle.includes("n")) sx.top = offset;
  if (handle.includes("s")) sx.bottom = offset;
  if (handle.includes("w")) sx.left = offset;
  if (handle.includes("e")) sx.right = offset;
  if (handle === "n" || handle === "s") {
    sx.left = "50%";
    sx.transform = "translateX(-50%)";
    sx.cursor = "ns-resize";
  } else if (handle === "e" || handle === "w") {
    sx.top = "50%";
    sx.transform = "translateY(-50%)";
    sx.cursor = "ew-resize";
  } else {
    sx.cursor = handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
  }
  return sx;
}
