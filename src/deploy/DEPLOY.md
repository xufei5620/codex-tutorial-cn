# 部署说明（服务器版）

这套教程是**纯静态网页**：只有 HTML、CSS、一个 SVG 图标和一个 ZIP。没有数据库、没有后端、没有构建步骤。任何能托管静态文件的地方都能放，把整个仓库目录原样复制上去就是全部工作。

下面三种方式任选其一，从最省事到最可控排序。

## 方式一：Docker（推荐，一条命令）

前提：服务器装了 Docker。

```bash
git clone https://github.com/xufei5620/codex-tutorial-cn.git
cd codex-tutorial-cn
docker compose -f deploy/docker-compose.yml up -d
```

浏览器打开 `http://服务器IP:8080` 就能看到。以后更新内容：`git pull` 之后再执行一次同样的 `docker compose ... up -d --build`。

## 方式二：Caddy（自动 HTTPS，适合有域名的情况）

前提：域名已经解析到服务器；服务器装了 Caddy。

```bash
sudo mkdir -p /var/www/codex-tutorial
sudo cp -r ./* /var/www/codex-tutorial/          # 在仓库目录里执行
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile     # 先把里面的域名改成你的
sudo systemctl reload caddy
```

Caddy 会自动申请并续期 HTTPS 证书，不需要你管。

## 方式三：Nginx（最常见的服务器环境）

```bash
sudo mkdir -p /var/www/codex-tutorial
sudo cp -r ./* /var/www/codex-tutorial/
sudo cp deploy/nginx.conf /etc/nginx/conf.d/codex-tutorial.conf   # 先改域名
sudo nginx -t && sudo nginx -s reload
```

需要 HTTPS 的话，用 certbot：`sudo certbot --nginx -d 你的域名`。

## 部署后检查（两分钟）

1. 打开首页，点「从第 1 章开始」，能进入第 1 章。
2. 打开 `/ch08.html#s6`，页面能直接跳到 8.6 小节。
3. 打开一个不存在的地址（比如 `/abc`），应显示自定义的 404 页而不是服务器默认页。
4. 点首页的「下载离线版（ZIP）」，能下载。
5. 用手机打开一次，侧栏应折叠成顶部的「← 全部章节」。

## 更新内容的流程

内容改动只发生在仓库里；服务器上永远只是仓库的一份拷贝。所以每次更新都是同一套动作：改仓库 → 提交 → 在服务器上 `git pull`（或重新复制）→ 如果用 Docker 就重新 `up -d --build`。不要直接在服务器上改文件，否则下次同步会被覆盖。

## 关于目录里的维护者资料

`templates/`、`specs/`、`schemas/`、`registry/` 和几份维护流程页面是给维护者看的，读者用不到。它们会一起部署上去（首页底部「维护者资料」里有链接），但 `robots.txt` 已声明不让搜索引擎收录。如果你不想公开它们，部署前删掉这几个目录即可，不影响读者页面。
