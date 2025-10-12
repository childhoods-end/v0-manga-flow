# Supabase Email Auth 启用指南

## 步骤 1: 启用 Email Provider

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 在左侧菜单找到 **Authentication** → **Providers**
4. 找到 **Email** provider
5. 确保 **Enable Email provider** 开关是打开状态（绿色）
6. **Enable email confirmations** 可以选择：
   - ✅ **开启**：用户注册后需要点击邮件中的确认链接才能登录（推荐，更安全）
   - ❌ **关闭**：用户注册后立即可以登录（方便测试）

## 步骤 2: 配置站点 URL 和重定向 URL

1. 在左侧菜单找到 **Authentication** → **URL Configuration**
2. 配置以下 URL：

### Site URL（站点 URL）
设置为你的主域名：
```
https://your-domain.vercel.app
```
或者如果有自定义域名：
```
https://your-custom-domain.com
```

### Redirect URLs（重定向 URL）
添加以下 URL（每个一行）：
```
https://your-domain.vercel.app/auth
https://your-domain.vercel.app/translate
http://localhost:3000/auth
http://localhost:3000/translate
```

**解释**：
- 生产环境 URL（https://your-domain...）用于部署后
- localhost URL 用于本地开发测试

## 步骤 3: 配置邮件模板（可选但推荐）

1. 在左侧菜单找到 **Authentication** → **Email Templates**
2. 可以自定义以下邮件模板：

### Confirm signup（确认注册）
默认模板：
```html
<h2>确认您的注册</h2>
<p>点击下面的链接确认您的邮箱地址：</p>
<p><a href="{{ .ConfirmationURL }}">确认邮箱</a></p>
```

### Magic Link（魔术链接登录）
如果启用魔术链接登录功能：
```html
<h2>登录 MangaFlow</h2>
<p>点击下面的链接登录：</p>
<p><a href="{{ .TokenHash }}">登录</a></p>
```

### Reset Password（重置密码）
```html
<h2>重置密码</h2>
<p>点击下面的链接重置您的密码：</p>
<p><a href="{{ .TokenHash }}">重置密码</a></p>
```

## 步骤 4: 配置 SMTP（可选，用于自定义邮件发送）

如果你想使用自己的邮件服务器（如 Gmail、SendGrid）：

1. 在 **Authentication** → **Settings** 中找到 **SMTP Settings**
2. 配置：
   - **SMTP Host**: smtp.gmail.com
   - **SMTP Port**: 587
   - **SMTP User**: your-email@gmail.com
   - **SMTP Password**: 你的应用专用密码
   - **Sender Email**: your-email@gmail.com
   - **Sender Name**: MangaFlow

**注意**：如果不配置 SMTP，Supabase 会使用默认的邮件服务器，但有发送限制。

## 步骤 5: 测试认证流程

### 测试注册
1. 访问 `https://your-domain.vercel.app/auth`
2. 切换到"注册"标签
3. 输入邮箱和密码（至少6个字符）
4. 点击"注册"

**如果启用了邮箱确认**：
- 检查邮箱，点击确认链接
- 确认后自动跳转到 `/translate` 页面

**如果关闭了邮箱确认**：
- 注册后立即可以登录

### 测试登录
1. 访问 `https://your-domain.vercel.app/auth`
2. 在"登录"标签输入邮箱和密码
3. 点击"登录"
4. 应该自动跳转到 `/translate` 页面

### 验证中间件保护
1. **未登录状态**：直接访问 `/translate`
   - 应该自动重定向到 `/auth?redirect=/translate`
2. **已登录状态**：访问 `/translate`
   - 应该能正常访问页面
   - 右上角显示用户邮箱

## 常见问题

### Q: 注册后没有收到确认邮件？
**解决方案**：
1. 检查垃圾邮件文件夹
2. 在 Supabase Dashboard → Authentication → Logs 查看邮件发送日志
3. 确认 Site URL 配置正确
4. 考虑配置自定义 SMTP
5. 临时关闭 "Enable email confirmations" 用于测试

### Q: 登录后立即跳回登录页？
**解决方案**：
1. 检查浏览器控制台是否有错误
2. 确认 Redirect URLs 包含你的域名
3. 检查浏览器 Cookie 设置是否阻止第三方 Cookie
4. 在 Vercel 环境变量中确认 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 正确

### Q: 提示 "Invalid redirect URL"？
**解决方案**：
1. 在 Supabase → Authentication → URL Configuration 中添加你的域名到 Redirect URLs
2. 确保 URL 包含协议（http:// 或 https://）
3. 生产环境必须使用 https://

### Q: 如何禁用邮箱确认（用于开发测试）？
**步骤**：
1. Supabase Dashboard → Authentication → Providers → Email
2. 关闭 "Enable email confirmations"
3. 注册后用户可以立即登录，无需确认邮箱

### Q: 如何查看已注册的用户？
**步骤**：
1. Supabase Dashboard → Authentication → Users
2. 可以看到所有注册用户列表
3. 可以手动验证用户邮箱、删除用户等

## 安全建议

1. **生产环境务必启用邮箱确认**
2. **配置强密码策略**：
   - 在 Authentication → Policies 中配置
   - 最小长度、包含数字、特殊字符等
3. **启用 Rate Limiting**：
   - 防止暴力破解和垃圾注册
4. **考虑添加 reCAPTCHA**（需要额外配置）

## 下一步

认证配置完成后：
1. ✅ 测试注册和登录流程
2. ✅ 上传测试图片进行翻译
3. ✅ 在 Vercel Analytics 中查看事件追踪
4. ✅ 在 Supabase → Authentication → Users 中查看注册用户

如有问题，请查看：
- [Supabase Auth 官方文档](https://supabase.com/docs/guides/auth)
- [项目部署清单](./DEPLOYMENT.md)
- [Analytics 事件说明](./ANALYTICS.md)
