# 🚀 快速开始指南

如果你在配置 Vercel Blob 时找不到 Token，可以先用这个简化的方法测试功能。

## 📝 最小配置（只配置必需项）

### 1. 配置 Supabase（必需）

#### 1.1 注册并创建项目
1. 访问 https://supabase.com
2. 用 GitHub 登录
3. 点击 **"New Project"**
4. 填写信息：
   - Name: `mangaflow`
   - Database Password: 设置一个密码（记住它！）
   - Region: 选择 `Tokyo` 或 `Singapore`
5. 点击 **"Create new project"**，等待 1-2 分钟

#### 1.2 获取 API 密钥
1. 点击左侧 **"Project Settings"**（齿轮图标）
2. 点击 **"API"**
3. 复制以下信息：

**找到 Project URL**（在页面顶部）：
```
https://xxxxxxxx.supabase.co
```

**找到 API Keys**（往下滚动）：
- **anon public**: 点击复制按钮（很长的一串，以 eyJ 开头）
- **service_role**: 点击眼睛图标显示，然后复制（也是 eyJ 开头）

**Project ID**（就是 URL 中的 xxxxxxxx 部分）

#### 1.3 创建数据库表
1. 点击左侧 **"SQL Editor"**
2. 点击 **"New query"**
3. 把下面的 SQL 代码全部复制粘贴进去：

```sql
-- 创建 profiles 表
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  plan TEXT DEFAULT 'free',
  credits INTEGER DEFAULT 100,
  age_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 projects 表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  source_language TEXT DEFAULT 'ja',
  target_language TEXT DEFAULT 'en',
  total_pages INTEGER DEFAULT 0,
  processed_pages INTEGER DEFAULT 0,
  content_rating TEXT DEFAULT 'general',
  rights_declaration TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 pages 表
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  page_index INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  original_blob_url TEXT NOT NULL,
  processed_blob_url TEXT,
  thumbnail_blob_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 jobs 表
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  job_type TEXT NOT NULL,
  state TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

4. 点击 **"Run"** 按钮
5. 看到成功提示即可

### 2. 配置翻译 API（必需，二选一）

#### 🔵 选项 A：OpenAI（推荐，更稳定）

1. 访问 https://platform.openai.com
2. 注册/登录账号（可以用 Google 账号登录）
3. 点击右上角头像 → **"View API keys"**
   或直接访问 https://platform.openai.com/api-keys
4. 点击 **"Create new secret key"**
5. 输入名称：`mangaflow`
6. **立即复制密钥**（只显示一次！）
   - 格式：`sk-proj-xxxxx...` 或 `sk-xxxxx...`
7. 充值（必需）：
   - 点击左侧 **"Settings"** → **"Billing"**
   - 点击 **"Add payment method"**
   - 添加信用卡并充值最低 $5

#### 🟣 选项 B：Claude API（如果账号正常）

1. 访问 https://console.anthropic.com
2. 注册账号（用邮箱）
3. 验证邮箱并登录
4. 点击右上角账户菜单 → **"API Keys"**
5. 点击 **"Create Key"**
6. 输入名称：`mangaflow`
7. **立即复制密钥**（只显示一次！）
   - 格式：`sk-ant-api03-xxxxx...`
8. 充值：最低 $5

**⚠️ 注意**：如果 Claude 账号被封禁（显示 "account banned"），请使用 OpenAI

### 3. 配置环境变量

打开项目中的 `.env.local` 文件，修改为：

#### 如果使用 OpenAI：
```env
# ===== Supabase 配置 =====
NEXT_PUBLIC_SUPABASE_URL=https://你的项目ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...（复制你的 anon key）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...（复制你的 service_role key）
SUPABASE_PROJECT_ID=你的项目ID

# ===== Blob Storage（暂时跳过）=====
# BLOB_READ_WRITE_TOKEN=
USE_LOCAL_STORAGE=true

# ===== OpenAI API（使用 OpenAI 翻译）=====
OPENAI_API_KEY=sk-proj-你的OpenAI密钥
# ANTHROPIC_API_KEY=（不需要填）

# ===== 其他配置 =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_TRANSLATION_PROVIDER=openai
DEFAULT_OCR_PROVIDER=tesseract
FREE_TIER_MAX_PROJECTS=3
FREE_TIER_MAX_PAGES_PER_PROJECT=50
FREE_TIER_MAX_CONCURRENT_JOBS=2
```

#### 如果使用 Claude：
```env
# ===== Supabase 配置 =====
NEXT_PUBLIC_SUPABASE_URL=https://你的项目ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...（复制你的 anon key）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...（复制你的 service_role key）
SUPABASE_PROJECT_ID=你的项目ID

# ===== Blob Storage（暂时跳过）=====
# BLOB_READ_WRITE_TOKEN=
USE_LOCAL_STORAGE=true

# ===== Claude API（使用 Claude 翻译）=====
ANTHROPIC_API_KEY=sk-ant-api03-你的Claude密钥
# OPENAI_API_KEY=（不需要填）

# ===== 其他配置 =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_TRANSLATION_PROVIDER=claude
DEFAULT_OCR_PROVIDER=tesseract
FREE_TIER_MAX_PROJECTS=3
FREE_TIER_MAX_PAGES_PER_PROJECT=50
FREE_TIER_MAX_CONCURRENT_JOBS=2
```

**重要**：记得修改 `DEFAULT_TRANSLATION_PROVIDER` 为你选择的服务（`openai` 或 `claude`）

### 4. 启动项目

保存 `.env.local` 后：

```bash
# 安装依赖（如果还没装）
npm install
# 或
pnpm install

# 启动开发服务器
npm run dev
# 或
pnpm dev
```

### 5. 测试功能

1. 打开浏览器访问 http://localhost:3000
2. 点击 **"Start translating free"**
3. 填写项目信息
4. 上传一张测试图片
5. 点击 **"Start Translation"**

---

## ❓ 常见问题

### Q1: Vercel Blob Token 怎么获取？

**简答**：暂时不用管，在 `.env.local` 中设置 `USE_LOCAL_STORAGE=true` 即可测试。

**详细步骤**（如果真的需要）：
1. 访问 https://vercel.com
2. 登录后，点击 **"Add New..."** → **"Project"**
3. 导入你的 GitHub 仓库
4. 部署完成后，点击 **"Storage"** 标签
5. 点击 **"Create"** → 选择 **"Blob"**
6. 创建完成后，在 **Settings → Environment Variables** 中可以找到

### Q2: 上传时报错 "Unauthorized"

**原因**：Supabase 配置有问题

**解决**：
1. 检查 `.env.local` 中的 Supabase URL 和 Key 是否正确
2. 确保没有多余的空格
3. 确保 URL 以 `https://` 开头
4. 重启开发服务器（Ctrl+C 然后重新 `npm run dev`）

### Q3: 翻译时报错

**原因**：Claude API Key 无效或余额不足

**解决**：
1. 检查 API Key 是否正确复制
2. 访问 https://console.anthropic.com 检查账户状态
3. 确认是否需要充值

### Q4: SQL 脚本执行失败

**常见错误**：
- `relation "auth.users" does not exist`：这是正常的，可以忽略第一张表的错误
- 重新执行一次通常能解决问题

---

## 🎯 下一步

完成配置后：
1. ✅ 测试上传功能
2. ✅ 体验 AI 翻译
3. 📖 阅读完整的 `SETUP_GUIDE.md` 了解更多功能
4. 🚀 部署到 Vercel（可选）

---

## 💡 提示

- 第一次上传可能较慢（需要安装依赖）
- 建议用小图片测试（100KB 以内）
- 日志输出在终端，遇到问题先看终端错误信息
- F12 打开浏览器控制台也能看到错误

---

需要帮助？把错误信息告诉我！
