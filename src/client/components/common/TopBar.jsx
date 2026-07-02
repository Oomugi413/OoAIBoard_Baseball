// @ts-check
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";

/**
 * ページ共通の上部ナビゲーションバー。
 * @param {{ title: string }} props
 */
export default function TopBar({ title }) {
  return (
    <AppBar position="sticky" color="primary" elevation={2}>
      <Toolbar sx={{ gap: 1 }}>
        <Button color="inherit" component={RouterLink} to="/">
          Home
        </Button>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button color="inherit" component={RouterLink} to="/viewer">
            見る
          </Button>
          <Button color="inherit" component={RouterLink} to="/control">
            動かす
          </Button>
          <Button color="inherit" component={RouterLink} to="/settings">
            設定
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
