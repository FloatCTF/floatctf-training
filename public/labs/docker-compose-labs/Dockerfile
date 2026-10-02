# 从官方的 PHP 镜像开始，里面已经装好了 PHP 8.4 和 SQLite 驱动
FROM php:8.4-cli-alpine
# 建一个放数据库的目录
RUN mkdir /data
# 之后的指令和容器里的程序，都在 /app 目录里进行
WORKDIR /app
# 把构建目录里的 index.php 复制进镜像的 /app
COPY index.php .
# 说明程序监听 8000 端口；真正把端口发布出去，还要靠 -p 或 compose.yaml 里的 ports
EXPOSE 8000
# 容器启动时运行的命令
CMD ["php", "-S", "0.0.0.0:8000"]
