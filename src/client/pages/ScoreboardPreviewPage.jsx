// @ts-check
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { api } from "../api/client.js";
import TopBar from "../components/common/TopBar.jsx";
import ScoreboardView from "../components/scoreboard/ScoreboardView.jsx";

/**
 * 手順3の検証用ページ。ScoreboardView の見た目を確認するための一時的なプレビュー。
 * Control List / Score Input Page が実装されたら不要になる。
 */
export default function ScoreboardPreviewPage() {
  const [boards, setBoards] = useState([]);

  useEffect(() => {
    api("/api/boards").then(setBoards);
  }, []);

  return (
    <Box>
      <TopBar title="スコアボード表示プレビュー" />
      <Box sx={{ p: 2 }}>
        {boards.length ? (
          <Stack spacing={3}>
            {boards.map((board) => (
              <Box key={board.id} sx={{ maxWidth: 900 }}>
                <ScoreboardView board={board} />
              </Box>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">スコアボードがありません。</Alert>
        )}
      </Box>
    </Box>
  );
}
