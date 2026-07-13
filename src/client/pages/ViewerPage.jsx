// @ts-check
import { useEffect, useRef, useState } from "react";
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
import { isBoardCollapsed } from "../../shared/scoringRules.mjs";
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
const COMPACT_BOARD_ASPECT_RATIO = 1200 / 380;

export default function ViewerPage() {
  const { state } = useServerState();
  const boards = state.boards || [];
  const [viewerSettings, setViewerSettings] = useState(() => loadViewerSettings());
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  // ユーザーが何もない場所をクリックして選択を意図的に外した場合、SSEでboardsが
  // 更新されるたびに自動で再選択されてしまわないようにするためのフラグ。
  const manuallyDeselectedRef = useRef(false);

  useEffect(() => {
    setSelectedBoardId((current) => {
      if (manuallyDeselectedRef.current && !current) return current;
      return resolveSelectedBoardId(boards, current);
    });
  }, [boards]);

  const selectBoard = (id) => {
    manuallyDeselectedRef.current = false;
    setSelectedBoardId(id);
  };

  const deselectBoard = () => {
    manuallyDeselectedRef.current = true;
    setSelectedBoardId("");
  };

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
          onSelectBoard={selectBoard}
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
          onClick={(event) => {
            if (event.target === event.currentTarget) deselectBoard();
          }}
        >
          {boards.length ? (
            boards.map((board) => (
              <ViewerBoard
                key={board.id}
                board={board}
                selected={board.id === selectedBoardId}
                transform={getBoardTransform(viewerSettings, board.id)}
                zIndex={getBoardZIndex(viewerSettings, board.id)}
                onSelect={selectBoard}
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
  const [draftTransform, setDraftTransform] = useState(() => createViewerDraft(selectedTransform));

  useEffect(() => {
    setDraftTransform(createViewerDraft(selectedTransform));
  }, [selectedBoardId, selectedTransform.scale, selectedTransform.x, selectedTransform.y]);

  const updateDraftScale = (rawValue) => {
    setDraftTransform((current) => {
      const number = Number(rawValue);
      return {
        ...current,
        scale: rawValue,
        size: Number.isFinite(number) ? String(scaleToBoardSize(number)) : current.size
      };
    });
  };

  const updateDraftSize = (rawValue) => {
    setDraftTransform((current) => {
      const number = Number(rawValue);
      return {
        ...current,
        size: rawValue,
        scale: Number.isFinite(number) ? String(Math.round(boardSizeToScale(number))) : current.scale
      };
    });
  };

  return (
    <Box
      component="section"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(auto-fit, minmax(160px, 1fr))" },
        gap: 1,
        alignItems: "center",
        p: 1.5,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        "& > *": { minWidth: 0 }
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
      <DraftNumberField
        label="拡大率(%)"
        disabled={disabled}
        value={draftTransform.scale}
        onChange={updateDraftScale}
        onApply={() => onTransform({ scale: clampScale(numberOrFallback(draftTransform.scale, selectedTransform.scale)) })}
        inputProps={{ "data-viewer-scale-input": "" }}
      />
      <DraftNumberField
        label="サイズ(px)"
        disabled={disabled}
        value={draftTransform.size}
        onChange={updateDraftSize}
        onApply={() =>
          onTransform({ scale: boardSizeToScale(numberOrFallback(draftTransform.size, scaleToBoardSize(scale))) })
        }
        inputProps={{ "data-viewer-size-input": "" }}
      />
      <DraftNumberField
        label="位置X(右基準)"
        disabled={disabled}
        value={draftTransform.x}
        onChange={(value) => setDraftTransform((current) => ({ ...current, x: value }))}
        onApply={() => onTransform({ x: numberOrFallback(draftTransform.x, selectedTransform.x) })}
        inputProps={{ "data-viewer-x": "" }}
      />
      <DraftNumberField
        label="位置Y(下基準)"
        disabled={disabled}
        value={draftTransform.y}
        onChange={(value) => setDraftTransform((current) => ({ ...current, y: value }))}
        onApply={() => onTransform({ y: numberOrFallback(draftTransform.y, selectedTransform.y) })}
        inputProps={{ "data-viewer-y": "" }}
      />
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button disabled={disabled} onClick={onReset}>表示リセット</Button>
        <Button onClick={onExport}>書き出し</Button>
        <Button onClick={onImport}>読み込み</Button>
      </Stack>
    </Box>
  );
}

function DraftNumberField({ label, disabled, value, onChange, onApply, inputProps }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        label={label}
        type="text"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onApply();
        }}
        size="small"
        slotProps={{ htmlInput: { inputMode: "numeric", ...inputProps } }}
        sx={{ minWidth: 0, flex: 1 }}
      />
      <Button disabled={disabled} onClick={onApply} sx={{ minWidth: 56, px: 1 }}>
        反映
      </Button>
    </Stack>
  );
}

function ViewerBoard({ board, selected, transform, zIndex, onSelect, onTransform }) {
  const pointerState = useRef(null);
  const [, refreshTransition] = useState(0);
  const visualWidth = scaleToBoardSize(transform.scale);
  const effectiveShowMatchup = board.displayOptions.showMatchup && !isBoardCollapsed(board.gameState);
  const boardAspectRatio = effectiveShowMatchup ? BOARD_ASPECT_RATIO : COMPACT_BOARD_ASPECT_RATIO;
  const visualHeight = visualWidth / boardAspectRatio;

  // 攻守交代の中間表示は、サーバーからの新しい通知なしで10秒後に自動終了する。
  // board propが更新されない限りこのコンポーネントは再レンダリングされないため、
  // ScoreboardView内部と同様のタイマーがないと、折りたたみ状態のままの高さで
  // 取り残され、展開後のスコアボード本体が枠からはみ出して見える不具合になる。
  useEffect(() => {
    const expiresAt = Number(board.gameState.halfInningTransition?.expiresAt || 0);
    if (!expiresAt) return undefined;
    const timeout = window.setTimeout(
      () => refreshTransition((current) => current + 1),
      Math.max(0, expiresAt - Date.now()) + 25
    );
    return () => window.clearTimeout(timeout);
  }, [board.gameState.halfInningTransition?.expiresAt]);

  const startPointer = (event) => {
    if (event.button !== 0) return;
    const handle = event.target instanceof Element
      ? event.target.closest("[data-resize-handle]")?.dataset.resizeHandle || resolveResizeHandle(event)
      : "";
    const stageRect = event.currentTarget.closest("[data-viewer-stage]")?.getBoundingClientRect();
    const stageWidth = stageRect?.width || 0;
    const stageHeight = stageRect?.height || 0;
    pointerState.current = {
      boardId: board.id,
      handle,
      stageWidth,
      stageHeight,
      startLeft: stageWidth - transform.x - visualWidth,
      startTop: stageHeight - transform.y - visualHeight,
      startWidth: visualWidth,
      scale: transform.scale,
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
    let next;
    if (current.handle) {
      next = resizeFromPointer(current.handle, current.startLeft, current.startTop, current.startWidth, current.aspectRatio, dx, dy);
    } else {
      next = { left: current.startLeft + dx, top: current.startTop + dy, width: current.startWidth, scale: current.scale };
    }
    onTransform({
      x: Math.round(current.stageWidth - next.left - next.width),
      y: Math.round(current.stageHeight - next.top - next.width / current.aspectRatio),
      scale: next.scale
    });
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
        right: `${transform.x}px`,
        bottom: `${transform.y}px`,
        width: `${visualWidth}px`,
        // heightは明示指定しない。中の.scoreboardがGSAPでaspect-ratioを直接
        // アニメーションさせる（useScoreboardFrame.js）ため、ここで別途pxの
        // heightをCSSトランジションさせると、2つの独立したアニメーションの
        // イージングがずれて、折りたたみ中に中身が外枠からはみ出して見える
        // 不具合になっていた。高さは常に中身（.scoreboard）に追従させる。
        height: "auto",
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

function createViewerDraft(transform) {
  const scale = Math.round(transform.scale);
  return {
    scale: String(scale),
    size: String(scaleToBoardSize(scale)),
    x: String(Math.round(transform.x)),
    y: String(Math.round(transform.y))
  };
}

function numberOrFallback(raw, fallback) {
  const number = Number(raw);
  return Number.isFinite(number) ? number : fallback;
}

function resizeFromPointer(handle, startLeft, startTop, startWidth, aspectRatio, dx, dy) {
  const startRight = startLeft + startWidth;
  const startBottom = startTop + startWidth / aspectRatio;
  const horizontalDelta = handle.includes("e") ? dx : handle.includes("w") ? -dx : 0;
  const verticalDelta = handle.includes("s") ? dy * aspectRatio : handle.includes("n") ? -dy * aspectRatio : 0;
  const widthDelta = Math.abs(horizontalDelta) >= Math.abs(verticalDelta) ? horizontalDelta : verticalDelta;
  const scale = clampScale(((startWidth + widthDelta) / DEFAULT_BOARD_WIDTH) * 100);
  const width = scaleToBoardSize(scale);
  const height = width / aspectRatio;
  return {
    left: handle.includes("w") ? startRight - width : startLeft,
    top: handle.includes("n") ? startBottom - height : startTop,
    width,
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
