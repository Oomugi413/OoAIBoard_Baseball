// @ts-check
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

/**
 * 削除などの操作前に確認を求める汎用ダイアログ。
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message: import("react").ReactNode,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 *   onConfirm: () => void,
 *   onClose: () => void
 * }} props
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "削除する",
  cancelLabel = "キャンセル",
  danger = true,
  onConfirm,
  onClose
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          color={danger ? "error" : "primary"}
          variant="contained"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
