# 邮箱注册链接无法打开 - 解决方案

## 问题描述
用户注册后收到的邮件中，点击确认链接无法打开或跳转到错误页面。

## 原因分析

邮箱确认链接由 Supabase 自动生成，格式通常是：
```
https://your-project.supabase.co/auth/v1/verify?token=xxx&type=signup&redirect_to=https://your-domain.com
```

常见问题：
1. **Site URL 配置错误** - Supabase 不知道应该重定向到哪个域名
2. **Redirect URLs 未包含确认后的目标页面**
3. **邮件模板中的重定向 URL 不正确**

## 解决方案

### 方案 1: 配置 Supabase URL（推荐）

#### 步骤 1: 设置 Site URL
1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. **Authentication** → **URL Configuration**
4. **Site URL** 设置为你的 Vercel 部署域名：
   ```
   https://your-project.vercel.app
   ```
   或自定义域名：
   ```
   https://your-domain.com
   ```

#### 步骤 2: 添加 Redirect URLs
在 **Redirect URLs** 中添加（每行一个）：
```
https://your-project.vercel.app/*
https://your-project.vercel.app/auth/callback
https://your-project.vercel.app/translate
http://localhost:3000/*
http://localhost:3000/auth/callback
```

**重要**: 使用通配符 `/*` 允许所有子路径

#### 步骤 3: 自定义邮件模板
1. **Authentication** → **Email Templates** → **Confirm signup**
2. 修改模板：

```html
<h2>确认您的邮箱</h2>

<p>感谢注册 MangaFlow！</p>

<p>请点击下面的按钮确认您的邮箱地址：</p>

<p>
  <a
    href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .SiteURL }}/translate"
    style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;"
  >
    确认邮箱
  </a>
</p>

<p>或者复制下面的链接到浏览器：</p>
<p style="word-break: break-all; color: #6B7280; font-size: 12px;">
  {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .SiteURL }}/translate
</p>

<p style="color: #6B7280; font-size: 12px; margin-top: 24px;">
  如果您没有注册 MangaFlow，请忽略此邮件。
</p>
```

### 方案 2: 禁用邮箱确认（开发测试用）

如果只是为了测试，可以临时禁用邮箱确认：

1. **Authentication** → **Providers** → **Email**
2. 关闭 **Enable email confirmations**
3. 用户注册后立即可以登录，无需确认邮箱

**注意**: 生产环境建议启用邮箱确认以防止垃圾注册

### 方案 3: 创建邮箱确认回调页面

由于 Supabase 的邮件链接会跳转到 `/auth/callback`，我们需要创建这个页面来处理确认：

**创建文件**: `app/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const redirect_to = requestUrl.searchParams.get('redirect_to') || '/translate'

  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      // Redirect to the app
      return NextResponse.redirect(new URL(redirect_to, request.url))
    }
  }

  // Redirect to error page if verification failed
  return NextResponse.redirect(new URL('/auth?error=verification_failed', request.url))
}
```

## 测试步骤

### 1. 测试邮箱确认流程
1. 访问 `https://your-domain.com/auth`
2. 使用一个新邮箱注册
3. 检查邮箱（包括垃圾邮件文件夹）
4. 点击确认链接
5. 应该自动跳转到 `/translate` 页面

### 2. 验证配置
在 Supabase Dashboard 检查：
- **Authentication** → **Users** - 新用户的 `email_confirmed_at` 字段应该有值
- 用户可以正常登录

### 3. 检查邮件日志
- **Authentication** → **Logs** - 查看邮件发送日志
- 如果邮件发送失败，会显示错误信息

## 常见错误及解决方案

### 错误 1: "Invalid redirect URL"
**原因**: 确认链接中的 redirect_to 不在 Supabase 允许的 Redirect URLs 列表中

**解决**:
- 在 Supabase → Authentication → URL Configuration
- 添加确认后要跳转的 URL 到 Redirect URLs

### 错误 2: 链接打开后显示 404
**原因**: `/auth/callback` 路由不存在

**解决**: 创建上述的 `app/auth/callback/route.ts` 文件

### 错误 3: 邮件没收到
**原因**:
- Supabase 默认邮件服务有发送限制
- 邮箱提供商拦截了邮件

**解决**:
- 检查垃圾邮件文件夹
- 配置自定义 SMTP（见下方）
- 临时禁用邮箱确认进行测试

### 错误 4: Token 已过期
**原因**: 确认链接有效期为 24 小时

**解决**:
- 重新注册或使用"重发确认邮件"功能
- 在 Supabase → Authentication → Policies 中调整过期时间

## 配置自定义 SMTP（可选）

如果 Supabase 默认邮件不稳定，可以配置自己的 SMTP：

### 使用 Gmail
1. **Authentication** → **Settings** → **SMTP Settings**
2. 配置：
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **User**: 你的 Gmail 地址
   - **Password**: [Gmail 应用专用密码](https://myaccount.google.com/apppasswords)
   - **Sender name**: MangaFlow
   - **Sender email**: 你的 Gmail 地址

### 使用 SendGrid
1. 注册 [SendGrid](https://sendgrid.com)（免费额度每天 100 封）
2. 获取 API Key
3. 配置 SMTP：
   - **Host**: `smtp.sendgrid.net`
   - **Port**: `587`
   - **User**: `apikey`
   - **Password**: 你的 SendGrid API Key

## 快速解决方案总结

**如果急需测试功能，最快的方式是**：

1. ✅ **临时禁用邮箱确认**
   - Supabase → Authentication → Providers → Email
   - 关闭 "Enable email confirmations"

2. ✅ **用户注册后立即可登录**，无需等待邮件

3. ⚠️ **记得在正式上线前重新启用邮箱确认**

## 需要帮助？

如果以上方案都不能解决问题：

1. 在 Supabase Dashboard → Authentication → Logs 查看详细错误
2. 检查浏览器控制台（F12）是否有错误信息
3. 提供错误截图以便进一步诊断

## 相关文档
- [Supabase Auth 官方文档](https://supabase.com/docs/guides/auth/auth-email)
- [Email 模板变量](https://supabase.com/docs/guides/auth/auth-email-templates)
- [SMTP 配置](https://supabase.com/docs/guides/auth/auth-smtp)
