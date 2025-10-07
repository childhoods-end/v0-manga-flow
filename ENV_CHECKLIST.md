# 环境变量配置检查清单

## ❌ 当前问题

你的 `.env.local` 文件还没有配置真实的值。所有的占位符都需要替换。

## ✅ 必须配置的项目（最小可运行配置）

### 1. Supabase 配置（必需）

**当前状态**：❌ 使用占位符
**需要做什么**：注册 Supabase 并获取真实密钥

```env
# 错误示例（当前）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co  # ❌
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key  # ❌
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # ❌

# 正确示例（应该是）
NEXT_PUBLIC_SUPABASE_URL=https://abcdefg.supabase.co  # ✅
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ✅
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ✅
```

**如何获取**：参考 `QUICK_START.md` 第 1 步

### 2. 翻译 API（必需，二选一）

**当前状态**：❌ 全部注释掉
**需要做什么**：至少配置 OpenAI 或 Claude

```env
# 选项 A：使用 OpenAI（推荐）
OPENAI_API_KEY=sk-proj-xxxxxxxxxx  # ✅ 取消注释并填写

# 选项 B：使用 Claude
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxx  # ✅ 取消注释并填写
```

**如何获取**：参考 `QUICK_START.md` 第 2 步

### 3. Blob Storage（可选，已跳过）

**当前状态**：✅ 使用本地存储
**不需要修改**

```env
USE_LOCAL_STORAGE=true  # ✅ 已正确配置
```

## 📋 完整配置步骤

### 步骤 1：配置 Supabase

1. 访问 https://supabase.com
2. 点击 **"Sign in"** → 用 GitHub 登录
3. 点击 **"New Project"**
4. 填写：
   - Name: `mangaflow`
   - Database Password: 设置一个密码
   - Region: 选择离你最近的（Tokyo/Singapore）
5. 等待项目创建（1-2分钟）
6. 创建完成后，点击 **"Project Settings"** → **"API"**
7. 复制以下内容：
   - **Project URL**：`https://xxxxxx.supabase.co`
   - **anon public key**：很长的字符串，以 `eyJ` 开头
   - **service_role key**：点击眼睛图标查看，也是 `eyJ` 开头

### 步骤 2：创建数据库表

1. 在 Supabase，点击 **"SQL Editor"**
2. 点击 **"New query"**
3. 复制 `DATABASE_SETUP.md` 中的完整 SQL
4. 点击 **"Run"**
5. 确认没有错误

### 步骤 3：配置 OpenAI（如果用 OpenAI）

1. 访问 https://platform.openai.com
2. 登录后，点击右上角头像 → **"View API keys"**
3. 点击 **"Create new secret key"**
4. 复制密钥（格式：`sk-proj-...` 或 `sk-...`）

### 步骤 4：修改 .env.local

打开 `.env.local` 文件，替换为真实值：

```env
# ===== Supabase（从步骤 1 获取）=====
NEXT_PUBLIC_SUPABASE_URL=https://你复制的项目ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ你复制的anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJ你复制的service_role_key...
SUPABASE_PROJECT_ID=你的项目ID

# ===== Blob Storage =====
USE_LOCAL_STORAGE=true

# ===== OpenAI（从步骤 3 获取）=====
OPENAI_API_KEY=sk-proj-你复制的OpenAI密钥

# ===== 其他配置 =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_TRANSLATION_PROVIDER=openai
DEFAULT_OCR_PROVIDER=tesseract
FREE_TIER_MAX_PROJECTS=3
FREE_TIER_MAX_PAGES_PER_PROJECT=50
FREE_TIER_MAX_CONCURRENT_JOBS=2
```

### 步骤 5：重启服务器

```bash
# 按 Ctrl+C 停止服务器
# 然后重新启动
npm run dev
```

### 步骤 6：验证配置

访问：http://localhost:3000/api/debug

应该看到：
```json
{
  "checks": {
    "supabaseConnection": {
      "url": "https://真实的项目.supabase.co",  // ✅
      "hasServiceKey": true
    },
    "demoProfile": "EXISTS",  // ✅
    "canInsertProfile": true,  // ✅
    "env": {
      "hasOpenAIKey": true  // ✅
    }
  },
  "errors": []  // ✅ 应该是空数组
}
```

## 🚨 常见错误

### 错误 1：URL 仍然是占位符
```
"url": "https://your-project.supabase.co"  // ❌ 错误
```
**解决**：替换为真实的 Supabase 项目 URL

### 错误 2：Key 格式错误
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key  // ❌ 错误
```
**解决**：应该是很长的字符串，以 `eyJ` 开头

### 错误 3：没有翻译 API
```
"hasOpenAIKey": false,
"hasAnthropicKey": false  // ❌ 至少要有一个
```
**解决**：配置 OpenAI 或 Claude API Key

## ⏱️ 预计时间

- Supabase 设置：10 分钟
- OpenAI 设置：5 分钟
- 总计：**15 分钟**

## 📞 需要帮助？

如果在配置过程中遇到问题：

1. **Supabase 注册失败**：检查网络，尝试用 VPN
2. **找不到 API Key**：查看文档中的截图路径
3. **数据库创建失败**：发送错误信息给我
4. **配置后还是不工作**：访问 `/api/debug` 并把结果发给我

配置完成后，重新测试上传功能！
