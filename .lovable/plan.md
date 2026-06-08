# AXI Studio 三端完整功能实施计划

## 总体说明

- **登录方式**：统一手机号验证码登录（已跑通），不接入微信（个人资质 + 备案域名问题）
- **角色路由**：登录后根据角色自动跳转 — `member` → `/`，`coach` → `/coach`，`admin` → `/admin`
- **数据隔离**：通过 RLS + `has_role()` 函数严格区分

---

## Phase 1：数据库改造（基础）

### 1.1 角色枚举扩展
现状：`app_role = ('member', 'admin')`
改造：增加 `'coach'` → `('member', 'coach', 'admin')`

### 1.2 profiles 表增加字段
- `nickname text` — 昵称
- `avatar_url text` — 头像
- `coach_id uuid` — 若该用户是教练，关联到自己（方便查 bookings）

### 1.3 课表配置表（新）
`class_schedules`：
- `weekday smallint` (0-6)
- `slot_hour smallint`
- `course_type course_type`
- `coach_id uuid`
- `is_active bool`
- 用途：管理员配置"每周固定课表模板"，前端按 weekday 渲染

### 1.4 取消规则约束
`bookings` 表增加触发器：会员取消时检查 `slot_date + slot_hour - now() >= 3 hours`，否则报错。管理员通过 service_role 绕过。

### 1.5 头像 Storage Bucket
创建 `avatars` bucket（public read，authenticated write，仅限自己的文件夹）

---

## Phase 2：会员端 `/`（已有基础，补全）

| 功能 | 状态 |
|------|------|
| 手机号验证码登录 | ✅ 已有 |
| 设置头像 + 昵称 | 🆕 新建 `/profile` 页 |
| 查看课表 | ✅ 已有 |
| 查看教练信息 | 🆕 新建 `/about` 页（教练介绍） |
| 约课 | ✅ 已有 |
| 提前3小时取消 | 🔧 加触发器 + 前端按钮按时间禁用 |
| 查看剩余次数 | ✅ 已有（member_credits） |

---

## Phase 3：教练端 `/coach`（全新）

路由：`src/routes/_authenticated/coach/`（用 `has_role('coach')` 守卫）

- `/coach` — 今日课表 + 每节课的报名会员列表（姓名 + 手机号）
- `/coach/schedule` — 本周/下周课表视图
- `/coach/stats` — 本周/本月数据：
  - 各课种上课节数（private/student/group/cardio）
  - 总课时数
  - 简单柱状图（用 recharts）
- `/coach/members` — 查看所有约过自己课的会员（手机号 + 头像 + 昵称 + 最近约课时间）

---

## Phase 4：管理员端 `/admin`（扩展现有）

现状：已有 `/admin` 处理购课申请。扩展：

- `/admin/credits` — **手动加课次**：输入会员手机号 → 选课种 → 加次数（替代现有的 purchase_requests 流程，直接根据线下收款操作）
- `/admin/coaches` — **教练管理**：输入手机号 → 设为教练（自动给该手机号对应 user 加 coach 角色）
- `/admin/schedule` — **课表编辑器**：
  - 周视图网格（横轴：周一到周日，纵轴：6:00-22:00）
  - 每个格子可设置：课种 + 教练
  - "复制本周到下周"按钮
  - "清空某天/某时段"
- `/admin/stats` — **工作室数据**：
  - 每周各课种上课节数
  - 团课 + 有氧课的约课人数（已约 / 容量 满）
- `/admin/bookings` — **强制取消**：任何时间都能取消任何预约（service_role）

---

## Phase 5：UI / 模板化（后续）

- 4 个客户端页面（about / courses / stories / faq）
- `site_settings` 表 + 后台配置中心
- 这部分上次已规划，放在三端跑通后做

---

## 实施顺序建议

我建议按这个顺序提交（每个阶段单独跑通再下一个）：

1. **Phase 1 数据库迁移**（一次性提交，需你审批）
2. **Phase 2 会员端补全**（头像昵称 + 取消规则）
3. **Phase 3 教练端**（全新，工作量较大）
4. **Phase 4 管理员端扩展**（4 个子页面）
5. **Phase 5 模板化**（最后做）

---

## 技术细节（给懂技术的人看）

- 角色路由跳转：在 `/auth` 登录成功后查 `user_roles` → 按角色 `navigate()`
- 教练端守卫：`src/routes/_authenticated/coach/route.tsx` 加 `beforeLoad` 检查 `has_role('coach')`
- 管理员手动加课次：用 `createServerFn` + `requireSupabaseAuth` + `has_role('admin')` 校验，内部用 `supabaseAdmin` 写 `member_credits`
- 课表编辑器：用 `class_schedules` 作为模板，渲染时按 `slot_date` 动态生成可约时段
- 3小时取消规则：DB 触发器是硬保障，前端按钮 disabled 是体验

---

## 一句话

跑通这 4 个 Phase，你的工作室就有了一套**真实可演示**的三端系统，可以直接给客户看："你只要告诉我你的业务，我改改文案、加减几个功能，就能交付。"

确认这个计划后，我就开始 Phase 1 的数据库迁移。