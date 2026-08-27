# Windows 安装说明

## 准备

1. 安装并启动 Docker Desktop。
2. 从 GitHub Releases 下载最新的 `Chainfolio-SelfHosted-vX.Y.Z.zip`。
3. 解压到长期保存的位置，例如 `D:\Chainfolio`，不要放在临时目录。

## 启动

在解压目录空白处按住 Shift 并点击鼠标右键，打开 PowerShell，然后执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start.ps1
```

浏览器会打开 `http://127.0.0.1:4173`。第一次进入时创建本地主账户，不需要作者提供邀请码。

## 日常操作

```powershell
.\scripts\stop.ps1
.\scripts\backup.ps1
.\scripts\update.ps1
```

`data` 是真实数据目录，`backups` 是本地备份目录。移动软件时必须一起移动这两个目录。
