import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// 各画面はReact移行が終わるまで旧クライアント(/legacy)を開く。
// ページの移植が完了したら、リンク先をReact側のルートへ切り替える。
const VIEWER_URL = "/legacy/#/viewer";
const CONTROL_URL = "/legacy/#/control";

export default function HomePage() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: "min(520px, 100%)" }} elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Baseball Scoreboard
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 3 }}>
            <Button variant="contained" size="large" href={VIEWER_URL}>
              スコアボードを見る
            </Button>
            <Button variant="contained" size="large" href={CONTROL_URL}>
              スコアボードを動かす
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            画面は新しいUIへ移行中です。上のボタンは、移行が終わるまで従来の画面を開きます。
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
