# 阿新工作室 — 会员系统 & 教练后台

## 一、会员手机验证码登录

**关键提醒（需您先确认）：** 中国大陆手机号短信验证码需要一家国内短信服务商（例如 **阿里云短信** 或 **腾讯云短信**）。Supabase 自带的 Twilio 渠道对国内号码送达率很差。建议方案：

- 我们自建一个 `/api/public/send-sms` 后端接口，调用阿里云短信下发 6 位验证码（验证码存到数据库，5 分钟有效）。
- 用户提交验证码后，后端校验通过 → 用 Supabase Admin 创建/查询用户并返回登录会话。
- 您需要提供阿里云的 `AccessKey ID / Secret / 短信签名 / 模板 CODE`（或者腾讯云相应凭证）。

**在您提供短信凭证之前**，我会先实现完整流程，但短信发送会用一个"开发模式"：验证码直接回写到前端 toast 显示，方便您先体验整个流程。等您拿到短信服务商凭证后，我再一行配置切换到真发短信。

## 二、数据库变更

新增表：

- `profiles` — 会员资料：`user_id (auth.users)`, `phone`, `display_name`, `created_at`
- `member_credits` — 每个会员每种课程剩余次数：`user_id`, `course_type`, `remaining`
- `credit_transactions` — 增减流水（购买、消课、教练手动调整）：`user_id`, `course_type`, `delta`, `reason`, `operator`
- `phone_otp` — 验证码：`phone`, `code_hash`, `expires_at`, `consumed`
- `app_roles` 枚举 + `user_roles` 表 — `admin` / `member`，配合 `has_role()` 安全函数（用于教练后台权限）

`bookings` 表加一列 `user_id (nullable)`，登录会员预约时写入。  
增加触发器：会员预约（非免费体验）时自动扣减 `member_credits`；若余额不足则报错。

RLS：会员只能读写自己的 profile/credits/bookings；教练（admin 角色）可读写所有人。

## 三、预约逻辑改造

- **未登录访客**：进入"体验预约"模式 — 只能看到团操课 / 有氧 cardio 课，并且每个手机号一生只能免费预约 **1 次**（用 `bookings.customer_phone + is_trial=true` 唯一约束保证）。
- **已登录会员**：进入"会员预约"模式 — 看到全部课程，预约时扣减对应课程的剩余次数。
- 顶部状态栏：未登录显示"登录会员"按钮；已登录显示昵称 + 各课程剩余次数。

## 四、会员中心 `/account`

- 我的预约（即将到来 / 历史）
- 课程剩余次数卡片（私教 / 中高考 / 团操 / 有氧）
- "购买课程"区块（仅展示价格表，**暂不接支付**，按"申请购买"按钮会生成一条待教练线下确认的工单 `purchase_requests` 表；后续接微信支付时再升级）：
  - 私教课 ¥800/节
  - 中高考应试 ¥300/节
  - 团操课 ¥200/节
  - 有氧 cardio ¥200/节

## 五、教练后台 `/admin`

- 用 **邮箱 + 密码** 登录（账号密码登录由您指定一个邮箱，我注册后授予 `admin` 角色；初始密码您登录后自行修改）。
- 路由放在 `_authenticated/` 下，再用 `has_role(uid, 'admin')` 服务端二次校验。
- 功能页：
  1. **会员列表**：姓名 / 手机 / 各课程剩余次数 / 累计预约数
  2. **会员详情**：手动调整剩余次数（+/-）、查看消费流水、查看预约记录
  3. **预约总览**：按日期查看所有时段被谁约了，可代客取消
  4. **购买申请**：处理会员提交的"购买课程"工单 → 确认到账后点击"充值"自动加次数

## 六、UI / 视觉

- 新封面：将 `coach-axi.jpg` 重新生成 — 一位身材健美、阳光自信的亚洲女性教练，彩色调（活力橙、运动绿、暖光），区别于现在的暗调男性形象。整体保持现有"亮绿运动感"设计系统不变。
- 首页 hero 区文案微调："阿新 · 私人健身工作室" 保留，副标题改为体现女教练气质。

## 七、技术实现（详细）

- **前端路由**新增：
  - `/auth` 公开 — 手机号验证码登录
  - `/_authenticated/account` 会员中心
  - `/_authenticated/admin` 教练后台（内含子页 `/admin/members`, `/admin/bookings`, `/admin/purchases`）
- **Server Functions**（`createServerFn`）：
  - `requestOtp({ phone })` → 写入 `phone_otp`，调用短信网关（开发模式下直接返回 code）
  - `verifyOtp({ phone, code })` → 校验后用 `supabaseAdmin.auth.admin` 创建/获取用户，签发 magic link token 让前端 `setSession`
  - `getMyCredits()` / `getMyBookings()` — 会员侧
  - `adminListMembers()` / `adminAdjustCredits()` / `adminListBookings()` — 教练侧（`has_role` 校验）
- **公共 API**：`/api/public/sms-webhook`（如果短信商有回执需要）
- **现有 `bookings.customer_phone`** 字段保留以兼容体验预约；登录后预约时同时填 `user_id`。

## 八、本轮交付范围（确认后即开工）

1. 数据库迁移（表、枚举、RLS、触发器、角色函数）
2. 手机验证码登录（开发模式，验证码 toast 显示）
3. 会员中心 + 课程剩余次数显示 + 购买申请
4. 教练后台（先做：会员列表 + 调整次数 + 预约总览；购买工单做简版）
5. 替换教练封面图为彩色女性形象
6. 首页区分体验预约 / 会员预约

## 需要您确认的 3 件事

1. 短信服务：**先用开发模式（验证码弹窗显示）** 跑通流程，等您拿到阿里云/腾讯云凭证再切真实发送？还是您现在就有凭证？
2. 教练后台登录邮箱：请告诉我一个邮箱地址，我会创建管理员账号并设一个初始密码（例如 `Axin@2026`），您首次登录后自行修改。
3. 体验预约规则："每个手机号免费体验一次"是否合适？还是您希望"每个手机号每月一次"？

确认后我就开始按上述方案实施。
