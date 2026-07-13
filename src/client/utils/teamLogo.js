// @ts-check
import { api } from "../api/client.js";

const TEAM_LOGO_SIZE = 256;

export async function uploadTeamLogo(dataUrl) {
  const result = await api("/api/uploads/team-logo", {
    method: "POST",
    body: JSON.stringify({ dataUrl })
  });
  return result.logoPath;
}

export function createTeamLogoDataUrl(file) {
  const mimeType = detectLogoMimeType(file);
  if (!mimeType) {
    return Promise.reject(new Error("PNGまたはJPEG画像を選択してください。"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error("画像を読み込めませんでした。")));
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("error", () => reject(new Error("画像を読み込めませんでした。")));
      image.addEventListener("load", () => {
        const canvas = document.createElement("canvas");
        canvas.width = TEAM_LOGO_SIZE;
        canvas.height = TEAM_LOGO_SIZE;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("画像を変換できませんでした。"));
          return;
        }
        if (mimeType === "image/jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(mimeType, 0.86));
      });
      image.src = String(reader.result || "");
    });
    reader.readAsDataURL(file);
  });
}

function detectLogoMimeType(file) {
  if (["image/png", "image/jpeg"].includes(file.type)) return file.type;
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}
