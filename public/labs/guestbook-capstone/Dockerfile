FROM php:8.4-cli-alpine
WORKDIR /app
# 只复制程序，不复制本机 data 目录里的数据库
COPY *.php ./
RUN mkdir data
EXPOSE 8000
CMD ["php", "-S", "0.0.0.0:8000"]
