# 一句话添加设备：服务端配置与边界

AI 是可选功能。默认未配置，设备管理、手动估值、演示和导出均可独立运行。没有规则提取冒充 AI，也没有在开发测试中使用真实密钥或发出收费请求。

1. 在项目目录内复制 `.env.example` 为 `.env.local`。
2. 自行确认 OpenAI 账户授权、对应模型价格与额度，再填写 `OPENAI_API_KEY` 和 `OPENAI_MODEL`。模型必须支持 Responses API 与 Structured Outputs；没有预设模型，以免自动选择费用或权限不合适的服务。
3. 将 `AI_ENABLED` 改为 `true`，重启本地服务。
4. 用户提交一句话后，服务端才会调用 API；提取结果只预填表单，必须由用户检查并点击保存。

密钥只由 `provider.server.ts` 从服务端环境变量读取。不要设置 `NEXT_PUBLIC_OPENAI_API_KEY`，不要把 `.env.local` 提交到仓库。状态接口只返回 `configured`，错误不会返回上游响应、请求头、密钥或原始输入。当前实现无外部遥测或应用日志。

`src/lib/ai/provider.server.ts` 定义独立 `AIProvider`，使用原生 `fetch` 请求 `https://api.openai.com/v1/responses`。结构化 JSON 使用 `text.format.type = json_schema`、`strict = true`，字段均必选但可为 `null`，禁止额外字段。`store: false` 关闭 Responses 响应持久保存；这不等于对服务提供方作“零数据保留”的承诺。用户输入会发送给所配置的 OpenAI 服务，需遵守该服务的数据政策。

路由位于 `src/app/api/ai/extract/route.ts`。GET 返回配置状态；POST 接收 `{ text, currency }`，币种只支持 CNY / USD / HKD，省略时默认为 CNY。只接受同源 JSON，限制请求体 16KB、描述 3000 字符，20 秒超时，处理拒绝回答、限流、失败及无效输出。应用默认仅监听 `127.0.0.1`。这不是带身份验证、速率限制和账单防护的公网 API，不应直接公开部署。

提取范围是明确提供的设备信息，估值不由 AI 生成。模型输出仍有局限，因此额外校验字段类型、日期和金额，并对品牌、型号、配置等执行原文片段检查，不在原文中的值置空。日期必须在原文包含完整年月日；例如“2026年5月”保留在 `purchaseDateText`，完整购买日期留空，由用户补充。金额仅保留带货币单位或符号的明确数字，不转换币种。币种与当前账户不同、包含多个币种、未知币种或仅有歧义符号 `$` 时，金额留空并返回 `warning` 说明。只写中文大写金额或复杂改写也可能被保守地置空，需要手填。该机制减少推测，不承诺语言模型绝无误提取；保存前的人工检查是必要步骤。

已实际查阅的官方文档（2026-11-08）：

- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)：REST 请求结构、JSON Schema 约束、nullable、refusal。
- [Create a model response](https://developers.openai.com/api/reference/resources/beta/subresources/responses/methods/create)：`store`、输出结构；实际使用标准 `/v1/responses` 端点，依据上面的 Structured Outputs REST 示例。

`tests/ai.test.ts` 全部使用内存 mock 响应，不访问网络、不产生费用；真实账户连通性尚未验证。
