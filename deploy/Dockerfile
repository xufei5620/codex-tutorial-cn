# Codex 中文入门教程 —— 容器镜像（Nginx 托管静态文件）
# 构建：docker build -t codex-tutorial -f deploy/Dockerfile .
# 运行：docker run -d --name codex-tutorial -p 8080:80 codex-tutorial
FROM nginx:1.27-alpine
COPY deploy/nginx.docker.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/deploy
