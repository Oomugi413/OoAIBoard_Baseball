import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import { useServerState } from "../api/useServerState.js";

export default function HomePage() {
  const { state, connected } = useServerState();
  const boardCount = state.boards.length;

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: "min(520px, 100%)" }} elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Baseball Scoreboard
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Chip
              size="small"
              color={connected ? "success" : "default"}
              label={`稼働中のスコアボード: ${boardCount}件`}
            />
            {!connected && (
              <Typography variant="caption" color="text.secondary">
                サーバーと再接続中…
              </Typography>
            )}
          </Stack>
          <Stack spacing={1.5} sx={{ mt: 3 }}>
            <Button variant="contained" size="large" component={Link} to="/viewer">
              スコアボードを見る
            </Button>
            <Button variant="contained" size="large" component={Link} to="/control">
              スコアボードを動かす
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            画面は新しいUIへ移行中です。移行が完了していない画面は、従来の画面が開きます。
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
