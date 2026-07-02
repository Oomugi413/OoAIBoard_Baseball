// @ts-check
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * 未移行のページを従来のクライアント(/legacy)へリダイレクトする。
 * `to`が関数の場合はルートパラメータを渡して呼び出し、遷移先を組み立てる。
 * @param {{ to: string | ((params: Record<string, string | undefined>) => string) }} props
 */
export default function LegacyRedirect({ to }) {
  const params = useParams();

  useEffect(() => {
    const target = typeof to === "function" ? to(params) : to;
    window.location.replace(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Typography variant="body2" color="text.secondary">
        従来の画面へ移動しています…
      </Typography>
    </Box>
  );
}
