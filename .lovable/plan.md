
## 一、登录体系改造

### 数据库
- `profiles` 增 `has_password BOOLEAN DEFAULT false`、`bio TEXT`、`specialties TEXT[] DEFAULT '{}'`
- 沿用 Supabase Auth 自带的 phone+password；密码哈希由 Auth 管理，我们不存

### /auth 页面（统一入口，新增 Tab）
```
[ 会员登录 ]  [ 教练登录 ]
┌────────────────────────┐
│  [验证码登录] [密码登录] │   ← 子 Tab
│  手机号: ___________    │
│  验证码/密码: _______    │
│  [获取验证码] [登录]     │
└────────────────────────┘
```
- 会员 Tab：成功 → `/account`（若无 role 默认 member）
- 教练 Tab：成功后校验是否有 `coach` role；无则报错"非教练账户"
- 密码登录：`supabase.auth.signInWithPassword({ phone, password })`
- 验证码登录：保持现有 OTP 流程

### 强制设密码
- 新增 `/set-password` 路由（在 `_authenticated` 下，无导航返回）
- `_authenticated/route.tsx` 在登录后检查 `profile.has_password`：false → `redirect('/set-password')`
- 校验：长度 ≥6，含字母+数字（特殊字符可选）
- 保存：`supabase.auth.updateUser({ password })` → 更新 `profiles.has_password = true` → 按 role 跳转

## 二、管理员课表编辑器 `/admin` → 新增"课表"Tab

利用现有 `class_schedules` 表（weekday/slot_hour/course_type/coach_id/is_active）

UI：周一~周日 × 时段（如 9-21 时）网格，每格点击弹出对话框：
- 选择课种（private/student/group/cardio）
- 选择教练（下拉列出所有 coach role 用户）
- 启用/停用开关
- 保存：upsert `class_schedules`

服务端函数：`adminUpsertSchedule`、`adminDeleteSchedule`、`adminListSchedules`、`adminListCoaches`

## 三、教练资料

### 教练端 `/coach` 新增"我的资料"Tab
- 头像上传（avatars bucket，路径 `coaches/{user_id}.jpg`，写 signed URL）
- 昵称（沿用 profile.nickname）
- 简介（bio）
- 擅长课种多选（specialties）
- 保存 → `profiles` 更新

### 管理员"教练管理"Tab 增强
现有：手机号添加/移除 coach role
新增：列出所有教练，点击编辑 → 同教练自己看到的字段（代为编辑）

## 四、文件清单

**新增**
- `src/routes/_authenticated/set-password.tsx`
- `src/lib/password.functions.ts` — `setMyPassword`、`getMyPasswordStatus`
- `src/lib/schedule-admin.functions.ts` — 课表 CRUD
- `src/lib/coach-profile.functions.ts` — 教练资料 + 头像签名 URL

**修改**
- 迁移：profiles 加字段
- `src/routes/auth.tsx`：加 Tab（会员/教练）+ 子 Tab（验证码/密码）
- `src/routes/_authenticated/route.tsx`：has_password 检查
- `src/lib/auth.functions.ts`：密码登录、has_password 查询
- `src/routes/_authenticated/admin.tsx`：加"课表"Tab + 教练编辑对话框
- `src/routes/_authenticated/coach.tsx`：加"我的资料"Tab

## 五、技术细节

- 密码校验正则：`/^(?=.*[A-Za-z])(?=.*\d).{6,}$/`
- 强制设密码路由不能被绕过：在 `_authenticated/route.tsx` 的 beforeLoad 里查询 `has_password`，false 且当前不在 `/set-password` 时 redirect
- 头像：private bucket + RLS 允许本人 + admin 上传，读取用 createSignedUrl（已有模式可复用）
- 教练 specialties 用 multi-select checkbox（4 个课种）

实施顺序：迁移 → 密码登录后端 → /auth 改造 → 强制设密码 → 课表编辑器 → 教练资料
