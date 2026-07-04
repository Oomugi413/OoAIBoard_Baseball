// @ts-check
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useServerState } from "../api/useServerState.js";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import TopBar from "../components/common/TopBar.jsx";
import EditMenu from "../components/menus/EditMenu.jsx";
import PlayerMenu from "../components/menus/PlayerMenu.jsx";
import ScoreboardView from "../components/scoreboard/ScoreboardView.jsx";

const BASE_LABELS = {
  first: "一塁",
  second: "二塁",
  third: "三塁"
};

/**
 * @param {{ title: string, children: import("react").ReactNode }} props
 */
function ControlGroup({ title, children }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 0 }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} useFlexGap sx={{ flexWrap: "wrap", minWidth: 0 }}>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * @param {{
 *   label: string,
 *   type: string,
 *   payload?: Record<string, any>,
 *   disabled?: boolean,
 *   variant?: "text" | "outlined" | "contained",
 *   color?: "primary" | "secondary" | "success" | "error" | "warning" | "info" | "inherit"
 *   onAction: (type: string, payload?: Record<string, any>) => void
 * }} props
 */
function ActionButton({
  label,
  type,
  payload = {},
  disabled = false,
  variant = "outlined",
  color = "primary",
  onAction
}) {
  return (
    <Button
      variant={variant}
      color={color}
      disabled={disabled}
      onClick={() => onAction(type, payload)}
      sx={{
        minWidth: { xs: 78, sm: 96 },
        maxWidth: "100%",
        flex: { xs: "1 1 88px", sm: "0 1 auto" },
        px: { xs: 1, sm: 2 },
        whiteSpace: "normal",
        lineHeight: 1.2
      }}
    >
      {label}
    </Button>
  );
}

export default function ScoreInputPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { state, refresh } = useServerState();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const board = (state.boards || []).find((item) => item.id === boardId);

  const runAction = async (type, payload = {}) => {
    if (!boardId || pending) return;
    setPending(true);
    try {
      await api(`/api/boards/${encodeURIComponent(boardId)}/action`, {
        method: "POST",
        body: JSON.stringify({ type, payload })
      });
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(false);
    }
  };

  const menuOpen = editOpen || playerOpen || resetConfirmOpen || finishConfirmOpen;

  useEffect(() => {
    if (!board || pending || menuOpen) return undefined;
    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;
      const isUndoRedoKey = event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey);
      if (!isUndoRedoKey) return;
      event.preventDefault();
      runAction(event.shiftKey ? "history:redo" : "history:undo");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [board, pending, menuOpen, runAction]);

  if (!board) {
    return (
      <Box>
        <TopBar title="スコア入力" />
        <Box component="main" sx={{ p: 2, maxWidth: 900, mx: "auto" }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            スコアボードが見つかりません。
          </Alert>
          <Button variant="contained" onClick={() => navigate("/control")}>
            一覧へ戻る
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <TopBar title="スコア入力" />
      <Box
        component="main"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(360px, 560px) 1fr" },
          alignItems: "start",
          gap: 2,
          p: { xs: 1, sm: 2 },
          overflowX: "hidden"
        }}
      >
        <Box
          sx={{
            position: { lg: "sticky" },
            top: { lg: 80 },
            width: "100%",
            minWidth: 0,
            "& .scoreboard": { minWidth: 0 }
          }}
        >
          <ScoreboardView board={board} />
        </Box>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <ControlGroup title="投球">
            <ActionButton label="ボール" type="pitch:ball" disabled={pending} variant="contained" color="success" onAction={runAction} />
            <ActionButton label="ストライク" type="pitch:strike" disabled={pending} variant="contained" color="warning" onAction={runAction} />
            <ActionButton label="ファウル" type="pitch:foul" disabled={pending} variant="contained" color="warning" onAction={runAction} />
            <ActionButton label="B -1" type="count:balls" payload={{ delta: -1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="B +1" type="count:balls" payload={{ delta: 1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="S -1" type="count:strikes" payload={{ delta: -1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="S +1" type="count:strikes" payload={{ delta: 1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="カウントRS" type="count:reset" disabled={pending} onAction={runAction} />
          </ControlGroup>

          <ControlGroup title="打席結果">
            <ActionButton label="HR" type="plate:result" payload={{ result: "homeRun" }} disabled={pending} variant="contained" color="error" onAction={runAction} />
            <ActionButton label="ヒット" type="plate:result" payload={{ result: "hit" }} disabled={pending} variant="contained" color="info" onAction={runAction} />
            <ActionButton label="四球" type="plate:result" payload={{ result: "walk" }} disabled={pending} variant="contained" color="success" onAction={runAction} />
            <ActionButton label="死球" type="plate:result" payload={{ result: "hitByPitch" }} disabled={pending} onAction={runAction} />
            <ActionButton label="凡退" type="plate:result" payload={{ result: "out" }} disabled={pending} onAction={runAction} />
            <ActionButton label="空三振" type="plate:result" payload={{ result: "strikeoutSwinging" }} disabled={pending} onAction={runAction} />
            <ActionButton label="見三振" type="plate:result" payload={{ result: "strikeoutLooking" }} disabled={pending} onAction={runAction} />
            <ActionButton label="その他" type="plate:result" payload={{ result: "other" }} disabled={pending} onAction={runAction} />
          </ControlGroup>

          <ControlGroup title="アウト">
            <ActionButton label="アウト -1" type="outs:adjust" payload={{ delta: -1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="アウト +1" type="outs:adjust" payload={{ delta: 1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="走塁死" type="outs:runningOut" disabled={pending} onAction={runAction} />
            <ActionButton label="盗塁死" type="outs:caughtStealing" disabled={pending} onAction={runAction} />
            <ActionButton
              label="チェンジ"
              type="inning:change"
              disabled={pending || board.gameState.outs !== 3}
              variant="contained"
              onAction={runAction}
            />
          </ControlGroup>

          <ControlGroup title="ランナー">
            {["first", "second", "third"].map((base) => (
              <ActionButton
                key={base}
                label={`${BASE_LABELS[base]} ${board.gameState.runners[base] ? "ON" : "OFF"}`}
                type="runner:toggle"
                payload={{ base }}
                disabled={pending}
                variant={board.gameState.runners[base] ? "contained" : "outlined"}
                color={board.gameState.runners[base] ? "warning" : "primary"}
                onAction={runAction}
              />
            ))}
          </ControlGroup>

          <ControlGroup title="得点">
            <ActionButton label="先攻 -1" type="score:adjust" payload={{ side: "away", delta: -1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="先攻 +1" type="score:adjust" payload={{ side: "away", delta: 1 }} disabled={pending} variant="contained" onAction={runAction} />
            <ActionButton label="後攻 -1" type="score:adjust" payload={{ side: "home", delta: -1 }} disabled={pending} onAction={runAction} />
            <ActionButton label="後攻 +1" type="score:adjust" payload={{ side: "home", delta: 1 }} disabled={pending} variant="contained" onAction={runAction} />
          </ControlGroup>

          {board.displayOptions.showAbs ? (
            <ControlGroup title="ABS">
              <ActionButton label="先攻 ABS -1" type="abs:adjust" payload={{ side: "away", delta: -1 }} disabled={pending} onAction={runAction} />
              <ActionButton label="先攻 ABS +1" type="abs:adjust" payload={{ side: "away", delta: 1 }} disabled={pending} onAction={runAction} />
              <ActionButton label="後攻 ABS -1" type="abs:adjust" payload={{ side: "home", delta: -1 }} disabled={pending} onAction={runAction} />
              <ActionButton label="後攻 ABS +1" type="abs:adjust" payload={{ side: "home", delta: 1 }} disabled={pending} onAction={runAction} />
            </ControlGroup>
          ) : null}

          <ControlGroup title="試合終了">
            <Button
              variant="outlined"
              color="error"
              disabled={pending || Boolean(board.gameState.finalResult)}
              onClick={() => setFinishConfirmOpen(true)}
            >
              試合終了
            </Button>
          </ControlGroup>

          <ControlGroup title="履歴とメニュー">
            <ActionButton label="戻る" type="history:undo" disabled={pending} onAction={runAction} />
            <ActionButton label="進む" type="history:redo" disabled={pending} onAction={runAction} />
            <Button color="error" disabled={pending} onClick={() => setResetConfirmOpen(true)}>
              スコアリセット
            </Button>
            <Button onClick={() => setEditOpen(true)}>編集メニュー</Button>
            <Button onClick={() => setPlayerOpen(true)}>選手名メニュー</Button>
          </ControlGroup>
        </Stack>
      </Box>
      {editOpen ? (
        <EditMenu
          open={editOpen}
          board={board}
          presets={state.presets || []}
          onClose={() => setEditOpen(false)}
          onSaved={setMessage}
          onError={setMessage}
          refresh={refresh}
        />
      ) : null}
      {playerOpen ? (
        <PlayerMenu
          open={playerOpen}
          board={board}
          onClose={() => setPlayerOpen(false)}
          onSaved={setMessage}
          onError={setMessage}
          refresh={refresh}
        />
      ) : null}
      <ConfirmDialog
        open={resetConfirmOpen}
        title="スコアをリセットしますか？"
        message="試合の進行状態、得点、カウント、ランナー、ABS、成績、投球数を初期状態に戻します。編集メニューの設定と選手名は残ります。"
        confirmLabel="リセットする"
        onConfirm={() => {
          setResetConfirmOpen(false);
          runAction("game:reset");
        }}
        onClose={() => setResetConfirmOpen(false)}
      />
      <ConfirmDialog
        open={finishConfirmOpen}
        title="試合を終了しますか？"
        message={`${finishPreviewMessage(board)} 敗者側の帯はグレー表示になり、"Final" を表示します。スコアリセット、または「戻る」で取り消せます。`}
        confirmLabel="試合終了する"
        onConfirm={() => {
          setFinishConfirmOpen(false);
          runAction("game:finish");
        }}
        onClose={() => setFinishConfirmOpen(false)}
      />
      <Snackbar
        open={Boolean(message)}
        autoHideDuration={4000}
        onClose={() => setMessage("")}
        message={message}
      />
    </Box>
  );
}

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

function teamLabel(board, side) {
  const team = board.teamSettings?.[side];
  return team?.abbreviation || team?.name || (side === "away" ? "先攻" : "後攻");
}

function finishPreviewMessage(board) {
  const { away, home } = board.gameState.score;
  if (away === home) return "現在同点のため、どちらの帯も配色を変えずに試合を終了します。";
  const winnerSide = away > home ? "away" : "home";
  return `現在のスコアでは ${teamLabel(board, winnerSide)} の勝利として試合を終了します。`;
}
