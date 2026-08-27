# 更新与回滚

Windows 用户运行 `scripts/update.ps1`，macOS/Linux 用户运行 `scripts/update.sh`。脚本会先备份数据，再拉取最新稳定镜像并检查服务状态。

更新前阅读 GitHub Release 说明。大版本更新如果包含不兼容迁移，应先复制整个安装目录。

需要回滚时：

1. 停止 Chainfolio。
2. 保存当前故障数据目录供排查。
3. 从 `backups` 解压更新前备份，恢复为 `data`。
4. 在 `compose.yaml` 中把镜像标签 `latest` 改成指定版本，例如 `1.0.0`。
5. 再次启动并检查数据。
