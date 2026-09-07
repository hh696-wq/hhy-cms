# HHY CMS

基于 **HHY Web + MySQL** 的开源企业建站 CMS。安装后即可获得企业官网与内容管理后台。

安装器、业务、数据库访问、权限与服务端页面使用 HHY 实现。前端使用 CSS 和少量原生 JavaScript，无需 Node.js 或前端构建。

## 功能

- 响应式企业主题：首页、关于、产品、案例、新闻、联系页。
- 内容分类、编辑、搜索、分页、草稿预览、发布与下线。
- 草稿与公开版本分离，保存草稿不会改变官网。
- 首页区块排序、显示隐藏和内容编辑。
- 图片上传、选择及引用删除保护；支持 PNG/JPEG，单张最大 2 MiB。
- 品牌、Logo、联系方式、导航、页脚、SEO 和 sitemap。
- 单管理员、MySQL 会话、CSRF 防护、登录限流与受限富文本。
- 安装迁移记录、失败恢复、非空库保护。

## 环境

- HHY **1.5.0** 与官方 **database 1.0.0** 扩展。
- MySQL **8.x 或兼容版本**，预先准备 `utf8mb4` 的独立空数据库。
- OpenSSL **3.x** 和系统 `file` 工具。

HHY 运行时及扩展见 [hhy-vm](https://github.com/hh696-wq/hhy-vm)。
使用本地 HHY 源码安装或升级数据库扩展：

```sh
hhy install --yes --upgrade /path/to/hhy-vm/extensions/database
```

数据库安装账号需要目标库的 `SELECT, INSERT, UPDATE, DELETE, CREATE` 权限。安装器不创建数据库，也不会覆盖非空数据库。

## 安装与启动

```sh
./bin/hhy-web run install.hhy --port 9100
```

打开 [安装向导](http://127.0.0.1:9100/install)。首次启动自动生成 `var/install-token`；复制令牌并在向导中填写 MySQL、站点和管理员信息。管理员密码至少 12 个字符，也可在页面生成随机密码。

安装完成后，同一个服务提供官网 `/` 和后台 `/admin`。后续启动：

```sh
./bin/hhy-web run app.hhy --port 9100
```

两个入口运行相同应用，不要同时占用同一端口。已安装站点的安装入口会关闭。

启动器依次查找 `HHY_BINARY`、PATH 中的 `hhy`，以及相邻 `hhy-vm/build/hhy`。也可使用已有的 HHY Web CLI：

```sh
hhy-web run app.hhy --port 9100
```

## 配置

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `CMS_PORT` | `9100` | 端口，命令行 `--port` 优先 |
| `CMS_HOST` | `127.0.0.1` | 监听 IPv4 地址 |
| `CMS_WORKERS` | `2` | Web Worker 数量 |
| `CMS_DATA_DIR` | `var` | 私有数据目录 |
| `CMS_OPENSSL` | `openssl` | OpenSSL 3 可执行文件 |
| `CMS_DB_ALLOW` | `127.0.0.1:3306,localhost:3306` | 允许的数据库端点，逗号分隔 |
| `HHY_BINARY` | 自动查找 | 启动器使用的 HHY 可执行文件 |

数据库凭据在安装向导中填写，不写入源码。使用非默认数据库端点时，由部署者设置 `CMS_DB_ALLOW`；远程连接必须验证 TLS 证书与主机名。

默认仅监听本机。公网部署需用反向代理提供 HTTPS；安装时填写 HTTPS 网站地址会启用 Secure Cookie。更换协议时同步调整私有配置中的 `secure_cookie`。当前登录限流按直接连接 IP 计算，反向代理部署需考虑共享 IP 的影响。

## 数据与恢复

运行目录 `var/` 包含私有配置、令牌、上传和临时文件，首次运行自动创建，不属于源码发行包。仅公开 `public/` 和受控上传目录，不要把项目根目录或整个 `var/` 暴露为静态资源。

安装中断后，修正连接或权限问题，再提交同一安装令牌即可继续。不要删除配置来重装已有数据库。备份与恢复需要同时包含 MySQL 内容、私有配置和上传文件，并妥善保护其中的凭据。

## 源码

- `app.hhy` / `install.hhy`：启动入口。
- `lib/`：安装、鉴权、发布、后台、官网路由和数据处理。
- `themes/default/`：接收展示数据的默认主题。
- `public/`：样式与编辑辅助脚本。
- `vendor/hhy-web/`：HHY Web 模块及上游许可证。
- `tests/`：HHY 校验测试。

## 验证

```sh
./bin/hhy-web check
./bin/hhy-web test
```

第一版提供单管理员和一套默认主题，暂不包含自由拖拽、多租户、商城、多语言内容和插件市场。源码包不包含运行时、数据库服务或已安装站点数据。

## 许可证

Apache-2.0。HHY Web 上游声明保留于 `vendor/hhy-web/LICENSE`。
