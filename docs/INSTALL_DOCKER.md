# Docker 安装说明

```bash
docker compose up -d
```

访问 `http://127.0.0.1:4173` 并创建本地主账户。默认端口只绑定本机；不要为了方便随意改成 `0.0.0.0:4173:4173`。

查看状态和日志：

```bash
docker compose ps
docker compose logs --tail 200
```

停止服务不会删除数据：

```bash
docker compose down
```

从源码构建时使用：

```bash
docker compose -f compose.build.yaml up -d --build
```
