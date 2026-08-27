# 维护者发布新版本

1. 确认 `main` 的 CI 全部通过。
2. 按语义化版本更新 `package.json`、`package-lock.json` 和 `CHANGELOG.md`。
3. 提交版本变更并推送。
4. 创建并推送标签，例如：

```bash
git tag -a v1.1.0 -m "Chainfolio v1.1.0"
git push origin v1.1.0
```

Release 工作流会运行完整测试、构建多架构 GHCR 镜像、生成 ZIP 和 SHA256，并创建 GitHub Release。

首次发布后，在 GitHub Packages 中确认 `chainfolio` 容器包为 Public，否则未登录用户无法拉取。发布完成后用一台没有开发环境的电脑测试 ZIP 安装、首次主账户创建、备份和更新。
