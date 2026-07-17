// @ts-check
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useServerState } from "../api/useServerState.js";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import TopBar from "../components/common/TopBar.jsx";
import { formatMatchupSummary } from "../../shared/scoringRules.mjs";

/**
 * スコアボード1件分のカード。名前編集・選択・削除を扱う。
 * @param {{ board: any, onRequestDelete: (board: any) => void, onRename: (id: string, name: string) => Promise<void> }} props
 */
function BoardCard({ board, onRequestDelete, onRename }) {
  const navigate = useNavigate();
  const [name, setName] = useState(board.name);
  const [dirty, setDirty] = useState(false);

  const displayName = dirty ? name : board.name;

  const commit = () => {
    setDirty(false);
    const trimmed = displayName.trim();
    if (trimmed && trimmed !== board.name) {
      onRename(board.id, trimmed);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {board.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMatchupSummary(board)}
            </Typography>
          </Box>
          <TextField
            label="スコアボード名"
            size="small"
            value={displayName}
            onChange={(event) => {
              setDirty(true);
              setName(event.target.value);
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => navigate(`/control/${board.id}`)}>
              選択
            </Button>
            <Button color="error" onClick={() => onRequestDelete(board)}>
              削除
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ControlListPage() {
  const { state } = useServerState();
  const navigate = useNavigate();
  const boards = state.boards || [];
  const [deleteTarget, setDeleteTarget] = useState(/** @type {any} */ (null));
  const [errorMessage, setErrorMessage] = useState("");

  const handleCreate = async () => {
    try {
      const created = await api("/api/boards", {
        method: "POST",
        body: JSON.stringify({ name: `Scoreboard ${boards.length + 1}` })
      });
      navigate(`/control/${created.id}`);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleRename = async (boardId, name) => {
    try {
      await api(`/api/boards/${encodeURIComponent(boardId)}/action`, {
        method: "POST",
        body: JSON.stringify({ type: "board:rename", payload: { name } })
      });
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/api/boards/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Box>
      <TopBar title="スコアボードを動かす" />
      <Box component="main" sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant="contained" onClick={handleCreate}>
            新規スコアボード作成
          </Button>
          <Button onClick={() => navigate("/settings")}>設定画面を開く</Button>
        </Stack>
        {boards.length === 0 ? (
          <Alert severity="info">まだスコアボードがありません。</Alert>
        ) : (
          <Stack spacing={2}>
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onRequestDelete={setDeleteTarget}
                onRename={handleRename}
              />
            ))}
          </Stack>
        )}
      </Box>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="スコアボードを削除"
        message={
          <>
            「{deleteTarget?.name}」を削除しますか？
            <br />
            削除すると、試合状態、選手名、操作履歴が消えます。
          </>
        }
        confirmLabel="削除する"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={4000}
        onClose={() => setErrorMessage("")}
        message={errorMessage}
      />
    </Box>
  );
}
