module.exports = {
  apps: [
    {
      name: "OoAIBoard_Baseball",
      cwd: "/home/oomugi413/git/OoAIBoard_Baseball",
      script: "npm",
      args: "start",

      // 必要に応じて環境変数をここに書く
      //env: {
      //  NODE_ENV: "production"
      //},

      // ログファイル
      out_file: "/home/oomugi413/git/OoAIBoard_Baseball/logs/out.log",
      error_file: "/home/oomugi413/git/OoAIBoard_Baseball/logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // 異常終了時に自動再起動
      autorestart: true,

      // メモリを使いすぎたときに再起動する例
      max_memory_restart: "4G"
    }
  ]
};
