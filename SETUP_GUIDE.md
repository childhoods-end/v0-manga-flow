# MangaFlow 环境配置详细指南

## 📋 前置准备

在开始之前，请确保你有：
- 一个 GitHub 账号
- 一个电子邮箱
- 一张信用卡（某些服务需要，但可能有免费额度）

---

## 1️⃣ Supabase 配置（数据库和认证）

### 步骤 1：创建 Supabase 项目

1. 打开浏览器，访问 https://supabase.com
2. 点击右上角 **"Start your project"** 或 **"Sign In"**
3. 选择 **"Continue with GitHub"** 使用 GitHub 账号登录
4. 登录后，点击 **"New Project"**

### 步骤 2：填写项目信息

1. **Organization**: 选择或创建一个组织（通常是你的用户名）
2. **Project name**: 输入 `mangaflow` 或任意名称
3. **Database Password**: 输入一个强密码（务必保存好）
4. **Region**: 选择离你最近的区域（例如：East Asia (Tokyo) 或 Southeast Asia (Singapore)）
5. **Pricing Plan**: 选择 **"Free"** 免费计划
6. 点击 **"Create new project"**
7. 等待 1-2 分钟，项目创建完成

### 步骤 3：获取 API 密钥

1. 项目创建完成后，点击左侧菜单的 **"Project Settings"**（齿轮图标）
2. 点击左侧的 **"API"**
3. 在页面中找到以下信息并复制保存：

   **Project URL**（类似这样）：
   ```
   https://abcdefghijklmnop.supabase.co
   ```

   **API Keys** 部分：
   - **anon public** key（很长的一串，以 `eyJ` 开头）
   - **service_role** key（点击右侧眼睛图标显示，也是以 `eyJ` 开头，保密！）

4. 找到 **Project ID**（在 General settings 页面）：
   ```
   abcdefghijklmnop
   ```

### 步骤 4：创建数据库表

1. 点击左侧菜单的 **"SQL Editor"**
2. 点击 **"New query"**
3. 复制以下 SQL 代码粘贴进去：

```sql
-- 创建 profiles 表
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  credits INTEGER NOT NULL DEFAULT 100,
  age_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建 projects 表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  source_language TEXT NOT NULL DEFAULT 'ja',
  target_language TEXT NOT NULL DEFAULT 'en',
  total_pages INTEGER NOT NULL DEFAULT 0,
  processed_pages INTEGER NOT NULL DEFAULT 0,
  content_rating TEXT NOT NULL DEFAULT 'general' CHECK (content_rating IN ('general', 'teen', 'mature', 'explicit')),
  rights_declaration TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建 pages 表
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  original_blob_url TEXT NOT NULL,
  processed_blob_url TEXT,
  thumbnail_blob_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, page_index)
);

-- 创建 text_blocks 表
CREATE TABLE text_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  bbox JSONB NOT NULL,
  ocr_text TEXT,
  translated_text TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ocr_done', 'translated', 'reviewed', 'flagged')),
  font_family TEXT NOT NULL DEFAULT 'Arial',
  font_size INTEGER NOT NULL DEFAULT 14,
  text_align TEXT NOT NULL DEFAULT 'center',
  is_vertical BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建 jobs 表
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('ocr', 'translate', 'render', 'export')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_pages_project ON pages(project_id);
CREATE INDEX idx_text_blocks_page ON text_blocks(page_id);
CREATE INDEX idx_jobs_project ON jobs(project_id);
CREATE INDEX idx_jobs_state ON jobs(state);

-- 启用 Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Users can view pages of own projects" ON pages FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = pages.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Users can view text_blocks of own projects" ON text_blocks FOR SELECT
  USING (EXISTS (SELECT 1 FROM pages JOIN projects ON pages.project_id = projects.id WHERE text_blocks.page_id = pages.id AND projects.owner_id = auth.uid()));
```

4. 点击右下角 **"Run"** 执行
5. 看到 "Success. No rows returned" 表示成功

### 步骤 5：配置认证

1. 点击左侧菜单的 **"Authentication"**
2. 点击 **"Providers"**
3. 确保 **"Email"** 已启用
4. 可选：配置第三方登录（Google、GitHub 等）

---

## 2️⃣ Vercel Blob Storage 配置（图片存储）

### 步骤 1：访问 Vercel 并导入项目

1. 打开 https://vercel.com
2. 使用 GitHub 账号登录
3. 点击 **"Add New..."** → **"Project"**
4. 选择你的 GitHub 仓库 `v0-manga-flow`
5. 点击 **"Import"**
6. 保持默认设置，点击 **"Deploy"**
7. 等待部署完成（可以先跳过，继续下一步）

### 步骤 2：创建 Blob Store

1. 在 Vercel Dashboard，点击顶部导航的 **"Storage"**
2. 点击 **"Create Database"**
3. 选择 **"Blob"**
4. 输入名称：`mangaflow-storage`
5. 选择 region（建议选择离你最近的）
6. 点击 **"Create"**

### 步骤 3：关联 Blob Store 到项目

1. 创建完成后，会看到 **"Connect Project"** 按钮
2. 点击 **"Connect Project"**
3. 选择你的项目 `v0-manga-flow`
4. 确认关联

### 步骤 4：获取 Token（3种方法）

**方法 A：从 Blob Store 页面获取**
1. 在 Storage 页面，点击你创建的 `mangaflow-storage`
2. 找到 **"Environment Variables"** 或 **"Quickstart"** 标签
3. 复制显示的 `BLOB_READ_WRITE_TOKEN` 值

**方法 B：从项目设置获取**
1. 回到你的项目（点击顶部的项目名称）
2. 点击 **"Settings"** → **"Environment Variables"**
3. 找到自动添加的 `BLOB_READ_WRITE_TOKEN`
4. 点击右侧的 **"..."** → **"Reveal"** 查看完整值
5. 复制这个值

**方法 C：手动生成（如果前两种方法都不行）**
1. 在项目的 **Settings** → **Environment Variables**
2. 点击 **"Add New"**
3. Name: `BLOB_READ_WRITE_TOKEN`
4. Value: 暂时留空，我们稍后会配置
5. 记住，这个 Token 的格式应该是：
   ```
   vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxx
   ```

### 🔍 如果还是找不到 Token：

**临时解决方案**：你可以先跳过 Blob Storage 配置，使用本地文件存储测试功能。

在 `.env.local` 中添加：
```env
# 暂时注释掉 Blob Token，使用本地存储
# BLOB_READ_WRITE_TOKEN=
USE_LOCAL_STORAGE=true
```

---

## 3️⃣ Claude API 配置（AI 翻译）

### 步骤 1：注册 Anthropic

1. 访问 https://console.anthropic.com
2. 点击 **"Sign Up"** 注册账号
3. 填写邮箱、验证邮件
4. 登录后完成账号设置

### 步骤 2：获取 API Key

1. 点击右上角的账户菜单
2. 选择 **"API Keys"**
3. 点击 **"Create Key"**
4. 输入名称：`mangaflow`
5. 点击 **"Create Key"**
6. **立即复制并保存密钥**（只显示一次！）：
   ```
   sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxx
   ```

### 步骤 3：充值（如需要）

1. 新账号可能有免费额度
2. 如需充值，点击 **"Billing"** → **"Add credits"**
3. 最低充值通常是 $5

### 替代方案：使用 OpenAI

如果你更熟悉 OpenAI：

1. 访问 https://platform.openai.com
2. 注册/登录账号
3. 点击右上角头像 → **"View API keys"**
4. 点击 **"Create new secret key"**
5. 复制保存：`sk-xxxxxxxxxxxxxxxxxxxxxx`

---

## 4️⃣ 配置 .env.local 文件

### 步骤 1：打开文件

在你的项目目录中找到 `.env.local` 文件：
```
c:\Soft\Coding\NextJs\v0-manga-flow\.env.local
```

### 步骤 2：填写配置

用记事本或 VS Code 打开，替换为你刚才获取的真实值：

```env
# ===== 必需配置 =====

# Supabase（从步骤 1 获取）
NEXT_PUBLIC_SUPABASE_URL=https://你的项目ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...你的anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...你的service_role_key...
SUPABASE_PROJECT_ID=你的项目ID

# Vercel Blob Storage（从步骤 2 获取）
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_你的token

# Claude API（从步骤 3 获取）
ANTHROPIC_API_KEY=sk-ant-api03-你的API密钥

# ===== 基础配置 =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_TRANSLATION_PROVIDER=claude
DEFAULT_OCR_PROVIDER=tesseract

# ===== 免费版限制 =====
FREE_TIER_MAX_PROJECTS=3
FREE_TIER_MAX_PAGES_PER_PROJECT=50
FREE_TIER_MAX_CONCURRENT_JOBS=2

# ===== 可选配置（暂时不用填）=====
# STRIPE_SECRET_KEY=
# OPENAI_API_KEY=
# DEEPL_API_KEY=
```

### 步骤 3：保存文件

保存后，**重启开发服务器**：

1. 在终端按 `Ctrl + C` 停止服务器
2. 运行：
   ```bash
   npm run dev
   # 或
   pnpm dev
   ```

---

## 5️⃣ 验证配置

### 测试 1：检查 Supabase 连接

打开浏览器控制台（F12），访问 http://localhost:3000，检查是否有错误。

### 测试 2：尝试上传

1. 访问 http://localhost:3000/translate
2. 填写项目信息
3. 上传一张测试图片
4. 看是否能成功上传

---

## ⚠️ 常见问题

### 问题 1：Supabase 连接失败
- 检查 URL 是否正确（需要 https://）
- 检查 API Key 是否完整复制
- 确保数据库表已创建

### 问题 2：Blob 上传失败
- 确认 Token 已正确配置
- 检查网络连接

### 问题 3：翻译失败
- 检查 API Key 是否有效
- 确认账户是否有余额/额度
- 查看控制台错误信息

---

## 📞 需要帮助？

如果遇到问题：
1. 查看终端的错误信息
2. 查看浏览器控制台（F12）的错误
3. 告诉我具体的错误信息，我来帮你解决

---

## 🎉 配置完成！

完成以上步骤后，你就可以开始使用 MangaFlow 了！

下一步：
- 创建第一个翻译项目
- 上传漫画页面
- 体验 AI 翻译功能
