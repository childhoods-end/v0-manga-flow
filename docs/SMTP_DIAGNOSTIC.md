# SMTP 邮件诊断指南

## 🔍 你遇到的问题

- ✅ Gmail SMTP 已配置
- ❌ 收不到邮件
- ❌ Supabase 界面找不到 "Send test email" 按钮

## 🚀 使用测试页面诊断

我已经创建了一个测试页面来帮你诊断问题：

### 步骤 1: 部署代码

代码已推送到 GitHub，等待 Vercel 自动部署（约 2-3 分钟）

### 步骤 2: 访问测试页面

部署完成后访问：
```
https://your-domain.vercel.app/test-email
```

### 步骤 3: 测试邮件发送

1. 输入你的邮箱地址
2. 点击"发送测试邮件"
3. 查看结果：
   - ✅ **成功** - 检查邮箱（包括垃圾邮件箱）
   - ❌ **失败** - 查看错误信息，按下方步骤排查

## 🔧 根据错误信息排查

### 错误 1: "Authentication failed" 或 "Invalid credentials"

**原因**: Gmail 密码错误

**解决步骤**:

1. **确认两步验证已启用**
   - 访问: https://myaccount.google.com/security
   - 查看 "两步验证" 是否已开启（必须开启）

2. **重新生成应用专用密码**
   - 访问: https://myaccount.google.com/apppasswords
   - 如果看不到此页面 → 说明两步验证未启用，返回步骤 1
   - 删除旧的 "MangaFlow" 密码
   - 创建新密码：选择 "邮件" → "其他" → 输入 "MangaFlow"
   - 复制 16 位密码（格式: `xxxx xxxx xxxx xxxx`）

3. **更新 Supabase 配置**
   - Supabase Dashboard → Project Settings → Auth → SMTP Settings
   - 找到 "SMTP Password" 字段
   - **粘贴密码时去掉所有空格**，变成 `xxxxxxxxxxxxxxxx`
   - 保存配置

4. **再次测试**
   - 返回 `/test-email` 页面重新测试

### 错误 2: "SMTP not configured" 或 "Email not sent"

**原因**: SMTP 配置未启用或不完整

**解决步骤**:

1. **检查 Supabase SMTP 设置**
   - Supabase Dashboard → Project Settings → Auth
   - 滚动到 **"SMTP Settings"** 部分
   - 确认 **"Enable Custom SMTP"** 开关是**开启**状态（蓝色）

2. **验证所有字段都已填写**
   ```
   ✅ Sender name: MangaFlow
   ✅ Sender email: your-email@gmail.com
   ✅ SMTP Host: smtp.gmail.com
   ✅ SMTP Port: 587
   ✅ SMTP Username: your-email@gmail.com (必须和 Sender email 相同)
   ✅ SMTP Password: xxxxxxxxxxxxxxxx (16位，无空格)
   ```

3. **保存并等待**
   - 点击页面底部的 "Save" 按钮
   - 等待 10-20 秒让配置生效

4. **再次测试**

### 错误 3: "Rate limit exceeded" 或 "Too many requests"

**原因**: 短时间内发送了太多邮件

**解决**:
- 等待 10-15 分钟后再试
- Gmail 限制: 每分钟约 20-30 封

### 错误 4: "Connection timeout" 或 "Network error"

**原因**: 网络连接问题或 Port 被阻止

**解决**:

1. **检查 Port 配置**
   - 确认使用的是 Port **587**（不是 465 或 25）

2. **尝试备用配置**（如果 587 不行）
   - Port: `465`
   - 同时修改其他设置保持不变

3. **检查 Supabase 状态**
   - 访问: https://status.supabase.com
   - 查看是否有服务中断

## 📊 查看 Supabase 日志

即使找不到 "Send test email" 按钮，你仍然可以查看邮件日志：

### 步骤 1: 打开日志页面

1. Supabase Dashboard → 左侧菜单
2. 找到 **"Authentication"** (人形图标)
3. 点击 **"Logs"** 子菜单

### 步骤 2: 筛选邮件日志

1. 在日志页面顶部找到筛选器
2. 选择或输入 "Email" 类型
3. 查看最近的邮件发送记录

### 步骤 3: 分析日志

**成功的日志**:
```
✅ Email sent to user@example.com
✅ Type: signup
✅ Status: 200
```

**失败的日志**:
```
❌ Failed to send email
❌ Error: Authentication failed
❌ Status: 500
```

根据错误信息，参考上方的"错误排查"部分

## 🎯 完整的 SMTP 配置检查清单

使用此清单确认每一步都正确：

### Gmail 部分
- [ ] ✅ Gmail 两步验证已启用
- [ ] ✅ 应用专用密码已生成
- [ ] ✅ 密码已复制（16位，含空格）
- [ ] ✅ 可以在 https://myaccount.google.com/apppasswords 看到密码

### Supabase SMTP 部分
- [ ] ✅ "Enable Custom SMTP" 开关已开启
- [ ] ✅ Sender name 填写: MangaFlow
- [ ] ✅ Sender email 填写: your-email@gmail.com
- [ ] ✅ SMTP Host 填写: smtp.gmail.com
- [ ] ✅ SMTP Port 填写: 587
- [ ] ✅ SMTP Username 填写: your-email@gmail.com（和 Sender email 相同）
- [ ] ✅ SMTP Password 填写: 16位密码（已去除空格）
- [ ] ✅ 点击了 "Save" 按钮
- [ ] ✅ 等待了 10-20 秒

### Supabase URL 配置
- [ ] ✅ Authentication → URL Configuration
- [ ] ✅ Site URL: https://your-domain.vercel.app
- [ ] ✅ Redirect URLs 包含:
  - [ ] https://your-domain.vercel.app/*
  - [ ] https://your-domain.vercel.app/auth/callback

### 邮箱确认设置
- [ ] ✅ Authentication → Providers → Email
- [ ] ✅ "Enable Email Provider" 已开启
- [ ] ✅ "Enable email confirmations" 已开启（如果需要邮箱验证）

## 🧪 测试方法

### 方法 1: 使用测试页面（推荐）

访问: https://your-domain.vercel.app/test-email

### 方法 2: 使用 API 端点

浏览器访问:
```
https://your-domain.vercel.app/api/test-email?email=your@email.com
```

### 方法 3: 实际注册

1. 访问: https://your-domain.vercel.app/auth
2. 使用新邮箱注册
3. 检查邮箱

## 🚨 仍然不行？临时解决方案

如果配置多次仍然失败，可以临时禁用邮箱验证：

### 快速修复（30秒）

1. Supabase Dashboard → Authentication → Providers → Email
2. **关闭** "Enable email confirmations"
3. 保存

**现在用户可以注册后立即登录，无需验证邮箱**

### 注意事项

⚠️ **这只是临时方案，正式上线前需要启用邮箱验证！**

原因：
- 防止垃圾注册
- 确认邮箱真实性
- 符合安全最佳实践

## 📞 获取帮助

如果尝试了所有方法仍然不行：

1. **截图提供**:
   - Supabase SMTP Settings 页面截图
   - `/test-email` 页面的错误信息截图
   - Supabase Logs 的错误日志截图

2. **检查项目**:
   - 项目是否在 Vercel 正确部署？
   - 环境变量是否正确配置？

3. **联系 Supabase 支持**:
   - 邮件: support@supabase.io
   - Discord: https://discord.supabase.com

## 💡 提示

**最常见的问题是**:
1. ❌ 应用专用密码粘贴时包含了空格
2. ❌ 两步验证未启用
3. ❌ Sender email 和 SMTP Username 不一致
4. ❌ "Enable Custom SMTP" 开关未开启
5. ❌ Port 写成了 465 或 25（应该是 587）

**仔细检查这 5 点，99% 的问题都能解决！**
