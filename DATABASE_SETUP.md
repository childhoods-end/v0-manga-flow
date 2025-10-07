# 数据库设置说明

如果你在上传时遇到外键约束错误，请按照以下步骤重新设置数据库：

## 方法 1：删除旧表并重新创建（推荐）

在 Supabase SQL Editor 中执行：

```sql
-- 1. 删除所有旧表（按顺序）
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. 创建 profiles 表（不依赖 auth.users）
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  credits INTEGER DEFAULT 100,
  age_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建 projects 表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  source_language TEXT DEFAULT 'ja',
  target_language TEXT DEFAULT 'en',
  total_pages INTEGER DEFAULT 0,
  processed_pages INTEGER DEFAULT 0,
  content_rating TEXT DEFAULT 'general' CHECK (content_rating IN ('general', 'teen', 'mature', 'explicit')),
  rights_declaration TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建 pages 表
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  original_blob_url TEXT NOT NULL,
  processed_blob_url TEXT,
  thumbnail_blob_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, page_index)
);

-- 5. 创建 jobs 表
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('ocr', 'translate', 'render', 'export')),
  state TEXT DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'done', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 创建索引
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_pages_project ON pages(project_id);
CREATE INDEX idx_jobs_project ON jobs(project_id);
CREATE INDEX idx_jobs_state ON jobs(state);

-- 7. 插入演示用户
INSERT INTO profiles (id, email, role, plan, credits, age_verified)
VALUES ('00000000-0000-0000-0000-000000000000', 'demo@example.com', 'user', 'free', 100, true)
ON CONFLICT (id) DO NOTHING;
```

## 方法 2：只插入演示用户

如果表已经存在，只需要插入演示用户：

```sql
-- 插入演示用户（如果不存在）
INSERT INTO profiles (id, email, role, plan, credits, age_verified)
VALUES ('00000000-0000-0000-0000-000000000000', 'demo@example.com', 'user', 'free', 100, true)
ON CONFLICT (id) DO NOTHING;
```

## 方法 3：检查现有数据

查看是否已有演示用户：

```sql
SELECT * FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000';
```

如果返回空结果，执行方法 2 的 INSERT 语句。

## 验证设置

执行完成后，运行以下查询验证：

```sql
-- 检查表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'projects', 'pages', 'jobs');

-- 检查演示用户
SELECT * FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000';
```

应该看到：
- 4 个表名
- 1 条演示用户记录

## 常见问题

### Q: 执行 DROP TABLE 时报错

**错误**: `table "xxx" does not exist`

**解决**: 忽略此错误，继续执行后续语句

### Q: INSERT 时报错 "duplicate key"

**解决**: 演示用户已存在，可以忽略此错误

### Q: 外键约束错误

**解决**: 确保按顺序创建表（profiles → projects → pages → jobs）

## 测试上传

设置完成后：

1. 重启开发服务器（Ctrl+C 然后 `npm run dev`）
2. 访问 http://localhost:3000/translate
3. 上传测试文件
4. 应该能成功创建项目了

如果还有问题，请查看：
- 浏览器控制台（F12）的错误信息
- 终端的错误日志
- Supabase Dashboard 的 Logs 页面
