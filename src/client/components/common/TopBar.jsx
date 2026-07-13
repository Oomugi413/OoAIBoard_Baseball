// @ts-check
import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";

/** 横3本線のメニューアイコン（追加ライブラリを使わないインラインSVG） */
function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * ページ共通の上部ナビゲーションバー。
 * @param {{ title: string }} props
 */
export default function TopBar({ title }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            onClick={() => setOpen(true)}
            aria-label="メニューを開く"
            edge="start"
          >
            <MenuIcon />
          </IconButton>
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
          <Box sx={{ width: 40 }} />
        </Toolbar>
      </AppBar>
      <Drawer anchor="left" open={open} onClose={close}>
        <Box sx={{ width: 260 }} role="navigation">
          <Typography variant="h6" component="div" sx={{ p: 2 }}>
            Baseball Scoreboard
          </Typography>
          <Divider />
          <List>
            <NavItem to="/" label="HOME" onClick={close} />
            <NavItem to="/viewer" label="見る" onClick={close} />
            <NavItem to="/control" label="動かす" onClick={close} />
            <NavItem to="/settings" label="設定" onClick={close} />
          </List>
        </Box>
      </Drawer>
    </>
  );
}

function NavItem({ to, label, onClick }) {
  return (
    <ListItemButton component={RouterLink} to={to} onClick={onClick}>
      <ListItemText primary={label} />
    </ListItemButton>
  );
}
