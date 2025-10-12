# 收不到验证邮件 - 解决方案

## 问题原因

### 1. Supabase 免费版邮件限制
- **每小时限制**: 最多 3-4 封邮件
- **每天限制**: 较少的配额
- **限流**: 短时间内多次注册会被限制

### 2. 其他可能原因
- 邮件进入垃圾邮件箱
- 邮箱服务商拦截
- Supabase 邮件服务暂时不可用

## 立即解决方案

### ✅ 方案 1: 临时禁用邮箱验证（推荐用于开发测试）

这是最快的解决方案，让用户注册后立即可以使用：

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. **Authentication** → **Providers** → **Email**
4. **关闭** "Enable email confirmations" 开关
5. 保存更改

**现在用户注册后可以直接登录，无需验证邮箱！**

### ✅ 方案 2: 手动验证用户（临时方案）

如果某个用户卡在等待验证状态：

1. **Authentication** → **Users**
2. 找到该用户
3. 点击用户进入详情页
4. 点击右上角的 **"Confirm Email"** 按钮
5. 用户邮箱会被标记为已验证，可以登录

### ✅ 方案 3: 检查邮件日志

查看邮件是否真的发送了：

1. **Authentication** → **Logs**
2. 筛选 "Email" 类型
3. 查看最近的邮件发送记录
4. 检查是否有错误信息

常见错误信息：
- `Rate limit exceeded` - 超过频率限制
- `SMTP error` - 邮件发送失败
- `Invalid email` - 邮箱格式错误

## 长期解决方案

### 方案 A: 配置自定义 SMTP（推荐用于生产环境）

使用自己的邮件服务，绕过 Supabase 限制：

#### 使用 Gmail（免费）

1. **准备 Gmail**
   - 登录你的 Gmail 账户
   - 开启两步验证: https://myaccount.google.com/security
   - 生成应用专用密码: https://myaccount.google.com/apppasswords
   - 选择 "Mail" 和设备，生成密码并保存

2. **配置 Supabase SMTP**
   - Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
   - 启用 "Enable Custom SMTP"
   - 填写配置：
     ```
     SMTP Host: smtp.gmail.com
     SMTP Port: 587
     SMTP User: your-email@gmail.com
     SMTP Password: [刚才生成的16位应用专用密码]
     Sender Email: your-email@gmail.com
     Sender Name: MangaFlow
     ```
   - 保存并测试

**Gmail 免费限制**: 每天 500 封邮件

#### 使用 Resend（推荐）

[Resend](https://resend.com) 是现代邮件 API，专为开发者设计：

1. **注册 Resend**
   - 访问 https://resend.com
   - 免费额度：每月 3,000 封邮件
   - 无需信用卡

2. **获取 API Key**
   - Dashboard → API Keys
   - 创建新的 API Key
   - 复制保存

3. **配置 Supabase**
   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 587
   SMTP User: resend
   SMTP Password: [你的 Resend API Key]
   Sender Email: onboarding@resend.dev (或你的自定义域名)
   Sender Name: MangaFlow
   ```

**优势**:
- 更高的到达率
- 详细的邮件分析
- 更好的开发者体验

#### 使用 SendGrid（企业级）

1. **注册 SendGrid**
   - 访问 https://sendgrid.com
   - 免费额度：每天 100 封邮件

2. **获取 API Key**
   - Settings → API Keys
   - Create API Key (Full Access)

3. **配置 Supabase**
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Password: [你的 SendGrid API Key]
   Sender Email: verified-email@yourdomain.com
   Sender Name: MangaFlow
   ```

### 方案 B: 实现魔术链接登录（无需密码）

让用户通过邮件链接直接登录，更简单：

**创建新的登录组件**:

```typescript
async function handleMagicLink() {
  const { error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    setError(error.message)
  } else {
    alert('登录链接已发送到您的邮箱，请查收！')
  }
}
```

## 测试 SMTP 配置

配置 SMTP 后，测试是否正常工作：

### 方法 1: 通过 Supabase Dashboard 测试
1. **Authentication** → **Email Templates** → 任意模板
2. 点击 "Send test email"
3. 输入你的邮箱
4. 检查是否收到邮件

### 方法 2: 实际注册测试
1. 使用新邮箱注册
2. 检查邮箱（包括垃圾邮件）
3. 查看 Authentication → Logs 确认发送状态

## 开发环境建议配置

### 推荐设置（开发阶段）

```
✅ 禁用邮箱验证 (Enable email confirmations: OFF)
✅ 使用 Supabase 默认邮件服务
✅ 手动验证测试用户
```

### 生产环境建议配置

```
✅ 启用邮箱验证 (Enable email confirmations: ON)
✅ 配置自定义 SMTP (Gmail/Resend/SendGrid)
✅ 自定义邮件模板
✅ 配置自定义域名邮箱
```

## 当前状态检查清单

运行以下检查确认问题：

### 检查 1: Supabase 邮件配置
- [ ] Site URL 是否正确？
- [ ] Redirect URLs 是否包含你的域名？
- [ ] Email provider 是否启用？

### 检查 2: 邮件发送日志
- [ ] Authentication → Logs 中是否有邮件发送记录？
- [ ] 是否显示 "Rate limit exceeded"？
- [ ] 是否有其他错误信息？

### 检查 3: 用户状态
- [ ] Authentication → Users 中用户是否存在？
- [ ] Email Confirmed 列是否为空？
- [ ] 可以手动点击 Confirm 验证用户

### 检查 4: 邮箱
- [ ] 检查收件箱
- [ ] 检查垃圾邮件箱
- [ ] 检查邮件规则/过滤器

## 紧急情况处理

如果需要立即让用户能使用系统：

### 临时方案（5分钟内生效）
1. ✅ 禁用邮箱验证
2. ✅ 用户重新注册（或手动验证现有用户）
3. ✅ 用户可以立即登录使用

### 完整方案（需要30分钟配置）
1. ✅ 配置 Gmail SMTP
2. ✅ 测试邮件发送
3. ✅ 重新启用邮箱验证
4. ✅ 用户正常注册收邮件

## 推荐操作流程

**现在立即做**:
1. 禁用邮箱验证（让系统可用）
2. 检查 Supabase Logs 确认问题

**稍后优化**:
1. 配置 Gmail 或 Resend SMTP
2. 测试邮件发送
3. 重新启用邮箱验证

**未来考虑**:
1. 使用企业邮箱（更专业）
2. 自定义域名邮箱
3. 添加邮件监控和告警

## 相关链接
- [Supabase SMTP 文档](https://supabase.com/docs/guides/auth/auth-smtp)
- [Gmail 应用专用密码](https://myaccount.google.com/apppasswords)
- [Resend 官网](https://resend.com)
- [SendGrid 官网](https://sendgrid.com)
