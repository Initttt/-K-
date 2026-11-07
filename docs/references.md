# 参考来源、依赖与开发工具

核查日期：2026-11-08。先通过用户已连接的 GitHub 插件搜索 `homebox`、`lucide`、`recharts`，每项只取最相关的少量结果；随后读取下列仓库的 README、许可证、包配置与仓库状态。没有克隆、搬入大型资产系统或执行其安装脚本，也没有复制仓库的应用代码、界面截图或品牌素材。

## 聚焦比较与取舍

| 仓库 | 许可证与维护情况（查询时） | 实际借鉴 / 使用 | 依赖、安装与权限审查 |
| --- | --- | --- | --- |
| [Homebox](https://github.com/sysadminsmedia/homebox) | AGPL-3.0；未归档，最近推送 2026-11-07。搜索同时发现原版 `hay-kot/homebox` 已归档 | 只参考家庭资产的类别、标签、购买日期与金额等信息组织思路。未复用代码或素材 | Go + SQLite + Nuxt/Vue；README 涉及 Docker、端口和数据卷，前端 `postinstall` 为 `nuxt prepare`。超出本版范围，没有安装、启动或授予权限 |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC；部分源于 Feather 的图标另带 MIT，完整许可证见 [licenses/lucide.txt](licenses/lucide.txt)。未归档，最近推送 2026-11-06 | 使用 `lucide-react` 提供统一的设备、导航与操作图标 | 无额外运行依赖，React 为 peer dependency；包配置无 `preinstall` / `install` / `postinstall`。仓库的构建与清理脚本未执行。无需账户、网络权限或费用 |
| [Recharts](https://github.com/recharts/recharts) | MIT；未归档，最近推送 2026-11-07 | 比较其“数据、坐标轴、折线分离”的组件思路。本版没有安装或复制 Recharts，简单历史曲线使用原创 SVG | 包依赖包括 Redux、Immer、victory-vendor 等；README 要求 `react-is` 与 React 版本匹配；源码含 `prepare: husky`。本版不需要这些附加依赖 |

原始审查文件：

- Homebox：[README](https://github.com/sysadminsmedia/homebox/blob/main/README.md)、[LICENSE](https://github.com/sysadminsmedia/homebox/blob/main/LICENSE)、[前端 package.json](https://github.com/sysadminsmedia/homebox/blob/main/frontend/package.json)。
- Lucide：[README](https://github.com/lucide-icons/lucide/blob/main/README.md)、[LICENSE](https://github.com/lucide-icons/lucide/blob/main/LICENSE)、[React 包配置](https://github.com/lucide-icons/lucide/blob/main/packages/lucide-react/package.json)。
- Recharts：[README](https://github.com/recharts/recharts/blob/main/README.md)、[LICENSE](https://github.com/recharts/recharts/blob/main/LICENSE)、[package.json](https://github.com/recharts/recharts/blob/main/package.json)。

## 基础技术栈

使用用户指定的 Next.js + TypeScript + Tailwind CSS，不使用外部应用模板。通过官方 npm registry 查询稳定发行版与 peer dependencies，再由项目锁文件固定安装结果。查询时稳定版本为 Next.js 16.4.5、React / React DOM 19.3.1、Tailwind CSS / PostCSS 插件 4.3.5、Lucide React 1.70.0；最终精确依赖以 `package.json` 和 `package-lock.json` 为准。

| 来源 | 授权 / 维护 | 使用内容与检查 |
| --- | --- | --- |
| [Next.js](https://github.com/vercel/next.js) | MIT；未归档，查询时最近推送 2026-11-07 | App Router、服务端 API 路由与本地开发/生产构建。已读 [README](https://github.com/vercel/next.js/blob/canary/readme.md)、[许可](https://github.com/vercel/next.js/blob/canary/license.md)、[包配置](https://github.com/vercel/next.js/blob/canary/packages/next/package.json)。Next 16.4.5 要求 Node >=20.9.0，支持 React 19 |
| [React](https://github.com/react/react) | MIT；未归档，查询时最近推送 2026-11-07 | 状态管理与界面组件。已读 README、LICENSE、React 包配置。旧 `facebook/react` 地址在插件中返回元数据错误，后用官方原始文件及迁移后的 `react/react` 仓库补充核查 |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT；未归档，查询时最近推送 2026-11-06 | 样式构建。已读 [README](https://github.com/tailwindlabs/tailwindcss/blob/main/README.md)、[许可](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE)、[包配置](https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/package.json) |

Next / React / Tailwind / Lucide 发布包没有声明安装阶段脚本；Next 的可选依赖含 SWC 与 Sharp，Tailwind PostCSS 插件依赖 Oxide 等原生构建包。安装不需要登录 GitHub、改变全局配置或获得额外服务权限。仓库源代码中的开发脚本与 npm 发布包的安装行为不是一回事。上述检查是选择依赖时的有限审查，不声称已逐行审计所有传递依赖。实际安装使用 `--ignore-scripts` 禁用安装脚本，再通过项目构建和测试验证兼容性。

首次 npm 10.9.4 在 Vitest/Vite 的可选 peer 依赖解析中抛出 `edgesOut` 错误；使用项目 `.cache/npm` 中的 npm 12.2.2 生成锁文件后成功安装，未修改全局 npm。npm 12 的 Node 引擎要求高于当前环境一个补丁版本，出现提示，但此次仅依赖安装成功退出。用户日常应使用锁文件执行 `npm ci --ignore-scripts`，无需安装这个临时 npm。

必要版权与完整许可另存于 `docs/licenses/`；安装后的依赖包也保留其自带 LICENSE。没有外部产品照片、付费字体或授权不明素材。界面图形与图表布局由本项目实现。

## 实际使用的插件、技能与边界

- **GitHub 插件**：只读搜索与拉取公开 README、许可证、配置、仓库元数据；不创建远程仓库、不提交、不推送。它只用于开发参考，运行中的应用没有接入 GitHub 数据服务。
- **Sites 技能**：按本地开发分支组织实现与检查；不创建托管站点，不调用发布或远程同步。
- **OpenAI Docs 技能 / 官方文档查询**：实际使用官方文档搜索和获取工具，核查 [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) 与 [Responses 创建接口参考](https://developers.openai.com/api/reference/resources/beta/subresources/responses/methods/create)。通过原生 `fetch` 调用 `/v1/responses`，使用严格 JSON Schema、`store: false`，无需新增模型 SDK。配置和未验证项见 [ai.md](ai.md)，没有实际付费调用。
- **Playwright 技能及项目内浏览器测试依赖**：用于本地页面实际操作和截图；结果以 README / 测试报告中的实际执行记录为准。
- 没有安装新的外部插件或 MCP 服务，没有扩大账户授权，没有使用任何未经用户授权的 API 密钥或执行付费调用。

## 行情与 AI 来源说明

本版没有接入真实行情源。演示设备及演示估值均为固定样例，明确标注“演示数据，非真实行情”。个人设备的手动估值由用户填写，来源、日期、地区、币种与价格类型随快照保存；应用没有把模拟价格包装成抓取结果或真实成交价。

AI 只用于辅助提取用户提供的设备信息，不生成市场估值。官方 API 调用代码可配置，但没有密钥时不调用，也不以规则提取或模拟响应冒充真实 AI。开发阶段使用文档工具不代表应用已获得模型服务授权。
