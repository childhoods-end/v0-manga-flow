# Vercel Analytics 追踪事件

本项目已集成 Vercel Analytics 来追踪用户行为和翻译使用情况。

## 追踪的事件

### 用户认证事件

#### `user_registered`
用户注册成功时触发
- **参数**:
  - `email`: 用户邮箱
  - `user_id`: Supabase 用户 ID

#### `user_logged_in`
用户登录成功时触发
- **参数**:
  - `user_id`: Supabase 用户 ID

#### `user_logged_out`
用户登出时触发
- **参数**: 无

### 翻译功能事件

#### `translation_uploaded`
用户上传漫画图片创建翻译项目时触发
- **参数**:
  - `user_id`: 用户 ID
  - `project_id`: 项目 ID
  - `image_count`: 上传的图片数量
  - `source_lang`: 源语言
  - `target_lang`: 目标语言

#### `translation_completed`
翻译任务完成时触发
- **参数**:
  - `user_id`: 用户 ID
  - `project_id`: 项目 ID
  - `page_count`: 翻译的页数

#### `translation_downloaded`
用户下载翻译后的图片时触发
- **参数**:
  - `user_id`: 用户 ID
  - `project_id`: 项目 ID
  - `page_count`: 下载的页数

## 在 Vercel Dashboard 查看数据

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 点击 "Analytics" 标签
4. 查看 "Events" 部分

### 关键指标

通过这些事件，你可以追踪：

- **每日注册用户数**: 统计 `user_registered` 事件
- **活跃用户数**: 统计 `user_logged_in` 事件（按日期去重）
- **翻译使用量**:
  - 每日翻译项目数: 统计 `translation_uploaded` 事件
  - 每日翻译图片总数: 对 `translation_uploaded` 的 `image_count` 求和
  - 翻译完成率: `translation_completed` / `translation_uploaded`
  - 下载率: `translation_downloaded` / `translation_completed`

## 隐私说明

- 所有事件追踪都符合隐私规范
- 不追踪用户个人身份信息（除了必要的 user_id）
- 用户邮箱仅在注册事件中记录，用于统计注册来源

## 开发环境

在本地开发环境，Analytics 事件会被记录但不会发送到 Vercel。只有在生产环境中才会实际追踪数据。
