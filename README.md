# Chainfolio

由 **蕉易猿-527** 发起的自托管、多钱包、多链资产与活动管理系统。只监控公开钱包地址，不需要也不应输入助记词或私钥。

Chainfolio 按“负责人 → 手机 → 钱包 → 链上地址 → 资产”建立归属关系，同时提供钱包创建时间、女巫检查、自定义活动字段、进度统计、资产分布和 CSV 导出。

## 为什么自托管

每位用户在自己的电脑运行一套独立 Chainfolio：

- 第一次打开时自行创建本地主账户，不需要作者提供邀请码。
- `data` 中的账户结构、备注和活动记录不进入作者服务器。
- 默认只监听 `http://127.0.0.1:4173`。
- 多人共用时，主账户可以选择开启一次性邀请码注册。
- 更新前可以自动备份，出现问题可恢复旧数据。

公开钱包地址仍会发送给所配置的区块链 RPC、行情和 DEX 服务用于余额及报价查询。自托管不等于完全离线。

## 最简单的 Windows 安装

1. 安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。
2. 在本仓库的 Releases 下载最新 `Chainfolio-SelfHosted-vX.Y.Z.zip`。
3. 解压后在目录中打开 PowerShell。
4. 运行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start.ps1
```

浏览器会打开 `http://127.0.0.1:4173`。根据页面提示创建你自己的本地主账户。

完整说明见 [Windows 安装](docs/INSTALL_WINDOWS.md)、[Docker 安装](docs/INSTALL_DOCKER.md) 和 [AI 部署指南](docs/DEPLOY_WITH_AI.md)。

## 更新与备份

```powershell
.\scripts\backup.ps1
.\scripts\update.ps1
.\scripts\stop.ps1
```

真实数据位于 `data`，备份位于 `backups`。不要把这两个目录提交到 GitHub 或发送给他人。详细说明见 [备份与恢复](docs/BACKUP.md) 和 [更新与回滚](docs/UPDATE.md)。

## 功能

- 负责人、手机、钱包、链上地址的分层管理与统一汇总。
- 钱包名称、生成时间、女巫状态、备注和自定义活动字段。
- 按负责人、手机、钱包、链、币种统计资产净值。
- 按链和按币种展示数量、价值及分布比例。
- 净值历史以及昨日、7 天、30 天、90 天或指定日期对比。
- EVM 地址一次导入，同步 Ethereum、Arbitrum、Base、Optimism、BNB Chain、Robinhood Chain、X Layer 及自定义 EVM 链。
- Solana 地址与 SPL Token。
- 输入 Token 合约或 Mint 后识别符号、名称和精度，并尝试自动报价。
- 全账户统一识别自定义 Token，无需逐钱包重复添加。
- 随机地址、随机批次、10–24 小时随机更新，也支持手动刷新。
- 金额隐私模式、20 条折叠、筛选、批量修改和 CSV 导出。

## 支持网络

内置 Ethereum、Solana、Arbitrum、Base、Optimism、BNB Chain、Robinhood Chain 和 X Layer。其他 EVM 网络可以通过名称、Chain ID 和可信 RPC 自定义导入。

## 从源码运行

需要 Node.js 22.13 或更高版本：

```bash
npm ci
node server.mjs
```

也可以直接构建本地 Docker 镜像：

```bash
docker compose -f compose.build.yaml up -d --build
```

测试：

```bash
npm test
npm run lint
```

## 数据与安全

- 绝不输入助记词、私钥、交易所密码、签名内容或提款 API Key。
- `data/state.json` 虽不含私钥，仍包含敏感的地址归属和管理记录。
- 隐藏金额只是界面遮挡，不是数据库加密。
- 公网部署需要 HTTPS、访问控制、系统更新和独立备份；普通用户优先使用默认本机部署。

更多信息见 [隐私说明](docs/PRIVACY.md) 和 [安全说明](SECURITY.md)。

## 发布与版本

`main` 分支通过 GitHub Actions 自动测试。推送 `vX.Y.Z` 标签后会自动：

- 构建 `linux/amd64` 和 `linux/arm64` Docker 镜像。
- 发布到 `ghcr.io/xuzhiliang12/chainfolio`。
- 生成自托管 ZIP、SHA256 校验文件和 GitHub Release。

版本变化记录见 [CHANGELOG](CHANGELOG.md)。

## 开源协议

项目源代码采用 [GNU Affero General Public License v3.0 or later](LICENSE)。修改后通过网络向用户提供服务时，请同时向这些用户提供对应版本源码。

Copyright © 2026 蕉易猿-527。项目按现状提供，不对资产数据、第三方 RPC、行情准确性或任何资金决策作担保。

## 作者与社区

- 作者：**蕉易猿-527**
- X：https://x.com/Eth527
- Telegram：https://t.me/Eth527
- OKX Wallet 邀请码：`527527`（可能为作者带来平台推广奖励，是否使用完全自愿）
