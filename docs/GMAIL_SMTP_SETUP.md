# Gmail SMTP 配置完整指南

## 为什么要配置 Gmail SMTP？

- ✅ **绕过 Supabase 邮件限制** - 每天 500 封邮件（vs Supabase 的 3-4 封/小时）
- ✅ **更高的送达率** - Gmail 信誉度高，不易被拦截
- ✅ **完全免费** - 使用个人 Gmail 账户
- ✅ **更好的调试** - Gmail 会保留已发送邮件记录

## 步骤 1: 准备 Gmail 账户

### 1.1 启用两步验证（必需）

Gmail 应用专用密码需要先启用两步验证：

1. 访问 https://myaccount.google.com/security
2. 找到 **"登录 Google"** 部分
3. 点击 **"两步验证"**
4. 按照提示启用（需要手机验证）

**重要**: 必须完成此步骤才能生成应用专用密码！

### 1.2 生成应用专用密码

1. 访问 https://myaccount.google.com/apppasswords
   - 如果看不到此页面，确认两步验证已启用

2. 点击 **"选择应用"** → 选择 **"邮件"**
3. 点击 **"选择设备"** → 选择 **"其他(自定义名称)"**
4. 输入名称: `MangaFlow Supabase`
5. 点击 **"生成"**

6. **重要**: 复制显示的 **16 位密码**（格式: `xxxx xxxx xxxx xxxx`）
   - 这个密码只显示一次
   - 建议保存到密码管理器

### 示例截图位置
```
Google 账户 → 安全性 → 两步验证 → 应用专用密码
```

## 步骤 2: 配置 Supabase SMTP

### 2.1 进入 SMTP 设置

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左下角 **"Project Settings"** (齿轮图标)
4. 选择 **"Auth"** 标签
5. 滚动到 **"SMTP Settings"** 部分

### 2.2 填写 SMTP 配置

启用 **"Enable Custom SMTP"** 开关，然后填写：

```
Sender name:        MangaFlow
Sender email:       your-email@gmail.com
SMTP Host:          smtp.gmail.com
SMTP Port number:   587
SMTP Username:      your-email@gmail.com
SMTP Password:      [粘贴刚才的16位密码，不含空格]
```

**重要提示**:
- ✅ **SMTP Password**: 粘贴时去掉空格，变成 `xxxxxxxxxxxxxxxx`
- ✅ **Sender email** 和 **SMTP Username** 必须相同
- ✅ **Port** 必须是 `587`（TLS 端口）

### 2.3 保存配置

点击页面底部的 **"Save"** 按钮

## 步骤 3: 测试邮件发送

### 方法 1: 通过 Supabase Dashboard 测试

1. **Authentication** → **Email Templates**
2. 选择任意模板（如 "Confirm signup"）
3. 点击 **"Send test email"** 按钮
4. 输入你的邮箱地址
5. 点击发送
6. 检查邮箱（包括垃圾邮件箱）

**预期结果**:
- ✅ 1-2 分钟内收到测试邮件
- ✅ 发件人显示为 `MangaFlow <your-email@gmail.com>`

### 方法 2: 实际注册测试

1. 在网站注册页面使用新邮箱注册
2. 检查是否收到确认邮件
3. 点击邮件中的链接测试确认流程

## 步骤 4: 自定义邮件模板

### 4.1 修改确认邮件模板

让邮件更专业、更不容易被标记为垃圾邮件：

**Authentication** → **Email Templates** → **Confirm signup**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                MangaFlow
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                漫画翻译平台
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                欢迎加入 MangaFlow！
              </h2>

              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                感谢您注册 MangaFlow。请点击下面的按钮确认您的邮箱地址，开始使用我们的 AI 漫画翻译服务。
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .SiteURL }}/translate"
                       style="display: inline-block; padding: 16px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      确认邮箱地址
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                如果按钮无法点击，请复制下面的链接到浏览器：
              </p>
              <p style="margin: 10px 0 0 0; padding: 12px; background-color: #f5f5f5; border-radius: 4px; word-break: break-all; font-size: 12px; color: #6b7280;">
                {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .SiteURL }}/translate
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                此链接将在 24 小时后过期。如果您没有注册 MangaFlow，请忽略此邮件。
              </p>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">
                © 2025 MangaFlow. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**为什么要自定义模板？**
- ✅ 更专业的外观 → 不容易被标记为垃圾邮件
- ✅ 品牌一致性 → 用户信任度更高
- ✅ 响应式设计 → 在手机上也好看
- ✅ 清晰的 CTA → 更高的点击率

### 4.2 其他邮件模板

你也可以自定义其他模板：
- **Magic Link** - 魔术链接登录
- **Change Email Address** - 更改邮箱确认
- **Reset Password** - 重置密码

## 步骤 5: 配置邮箱确认设置

### 5.1 启用邮箱确认

1. **Authentication** → **Providers** → **Email**
2. 确保 **"Enable email confirmations"** 开关是**开启**状态
3. 保存

### 5.2 配置重定向 URL

1. **Authentication** → **URL Configuration**
2. 确认以下设置：

**Site URL**:
```
https://your-project.vercel.app
```

**Redirect URLs** (每行一个):
```
https://your-project.vercel.app/*
https://your-project.vercel.app/auth/callback
https://your-project.vercel.app/translate
http://localhost:3000/*
http://localhost:3000/auth/callback
```

## 常见问题排查

### 问题 1: 仍然收不到邮件

**检查清单**:
1. Gmail 两步验证是否已启用？
2. 应用专用密码是否正确（16位，无空格）？
3. SMTP Port 是否为 587？
4. Sender email 和 SMTP Username 是否相同？

**测试方法**:
```bash
# 可以使用这个 Python 脚本测试 Gmail SMTP
python3 -c "
import smtplib
smtp = smtplib.SMTP('smtp.gmail.com', 587)
smtp.starttls()
smtp.login('your-email@gmail.com', 'your-app-password')
print('✅ SMTP 连接成功!')
smtp.quit()
"
```

### 问题 2: 邮件进入垃圾箱

**解决方案**:
1. 添加 SPF 记录（如果使用自定义域名）
2. 使用更专业的邮件模板（见上方）
3. 让用户将发件人添加到通讯录
4. 考虑使用专业邮件服务（Resend/SendGrid）

### 问题 3: "Authentication failed"

**原因**: 密码错误或两步验证未启用

**解决**:
1. 重新生成应用专用密码
2. 确认复制时没有包含空格
3. 确认两步验证已启用

### 问题 4: "Connection timeout"

**原因**: 网络或防火墙问题

**解决**:
1. 确认 Port 587 未被防火墙阻止
2. 尝试使用 Port 465（SSL）
3. 检查 Supabase 服务状态

## 测试清单

完成配置后，使用此清单验证：

- [ ] ✅ Gmail 两步验证已启用
- [ ] ✅ 应用专用密码已生成并保存
- [ ] ✅ Supabase SMTP 配置已保存
- [ ] ✅ 测试邮件发送成功
- [ ] ✅ 实际注册收到确认邮件
- [ ] ✅ 点击邮件链接可以确认账户
- [ ] ✅ 确认后可以正常登录
- [ ] ✅ 邮件模板已自定义（可选）

## Gmail 使用限制

了解 Gmail 的发送限制：

- **每天限制**: 500 封邮件
- **每分钟限制**: 约 20-30 封
- **收件人限制**: 每封邮件最多 100 个收件人

**对于 MangaFlow 来说**:
- ✅ 500 封/天足够处理大量用户注册
- ✅ 如果每天注册超过 500 人，考虑升级到企业邮件服务

## 升级方案（可选）

如果 Gmail 限制不够用，考虑：

### Resend（推荐）
- 免费: 3,000 封/月
- 价格: $20/月 50,000 封
- 优势: 专为开发者设计，API 简单

### SendGrid
- 免费: 100 封/天
- 价格: $15/月 40,000 封
- 优势: 企业级，功能强大

### Amazon SES
- 价格: $0.10 每 1,000 封
- 优势: 便宜，可扩展
- 劣势: 配置复杂

## 下一步

配置完成后：

1. ✅ 测试完整的注册 → 确认 → 登录流程
2. ✅ 在 **Authentication** → **Logs** 中监控邮件发送
3. ✅ 收集用户反馈，优化邮件模板
4. ✅ 考虑添加欢迎邮件（optional）

## 需要帮助？

如果遇到问题：
1. 检查 Supabase Dashboard → Authentication → Logs
2. 查看浏览器控制台错误信息
3. 测试 Gmail SMTP 连接
4. 联系 Supabase 支持（support@supabase.io）
