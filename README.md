# 护士排班系统 - 微信小程序

## 项目概述

这是一个**护士排班系统**微信小程序，用于医院科室的排班管理。支持护士长创建科室、管理成员、设置排班，护士查看排班、提交期望排班等功能。

- **开发模式**：支持模拟数据（`USE_MOCK = true`）与真实后端 API 切换
- **技术栈**：微信小程序原生开发（WXML、WXSS、JS）
- **核心特性**：
  - 支持多时间段班种（如两段班）
  - 支持跨天班次（次日标记 `+1`）
  - 日历组件支持滑动切换月份

---

## 一、页面结构

### 1.1 页面列表（共15个页面）

| 序号 | 页面路径 | 功能说明 | 权限 |
|------|----------|----------|------|
| 1 | `pages/login/login` | 登录页 - 微信一键登录入口 | 无限制 |
| 2 | `pages/role-select/role-select` | 角色选择页 - 选择护士长或护士身份 | 无限制 |
| 3 | `pages/index/index` | **首页** - 日历视图、排班展示、功能入口、成员列表 | 已登录用户 |
| 4 | `pages/create-department/create-department` | 创建科室页 - 护士长创建科室 | 护士长 |
| 5 | `pages/department-manage/department-manage` | 科室管理页 - 邀请成员、转让、解散 | 护士长 |
| 6 | `pages/member-list/member-list` | 成员列表页 - 查看/管理科室成员 | 护士长 |
| 7 | **`pages/member-info/member-info`** | **成员信息详情页** - 查看/编辑个人信息（新增） | 全员 |
| 8 | `pages/shift-manage/shift-manage` | 班种管理页 - 班种列表展示 | 护士长 |
| 9 | `pages/create-shift/create-shift` | 创建/编辑班种页 - 支持多时间段 | 护士长 |
| 10 | `pages/schedule/schedule` | 排班设置页 - 周视图排班编辑 | 护士长 |
| 11 | `pages/approval/approval` | 审批页 - 审批假勤/期望排班申请 | 护士长 |
| 12 | `pages/statistics/statistics` | 统计页 - 个人/科室排班统计 | 全员 |
| 13 | `pages/expect-schedule/expect-schedule` | 期望排班页 - 护士提交排班期望 | 全员 |
| 14 | `pages/leave-apply/leave-apply` | 假勤申请页 - 请假/调班/申请换班 | 全员 |
| 15 | `pages/print-schedule/print-schedule` | 打印排班页 - 导出排班表 | 护士长 |

### 1.2 页面跳转关系

```
登录页 (login)
    │
    ├── 已登录且有科室 ──────────────► 首页 (index)
    │
    └── 未登录或无科室
            │
            ▼
        角色选择页 (role-select)
            │
            ├── 选择护士长 ──► 创建科室页 ──► 首页
            │
            └── 选择护士(带邀请码) ──► 加入科室 ──► 首页
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              排班设置页          科室管理页           班种管理页
                    │                   │                   │
                    ▼                   ▼                   ▼
              打印排班页           成员列表页          创建班种页
                    │                   │                   │
                    ▼                   ▼                   ▼
              审批页  ◄───────────── 成员信息页 ◄─────   期望排班页
                    │                   ▲                   │
                    ▼                   │                   ▼
              统计页  ◄────────────────────────────────── 假勤申请页
```

---

## 二、用户角色与权限

### 2.1 角色定义

| 角色 | 标识 | 权限范围 |
|------|------|----------|
| **护士长（创建者）** | `isCreator = true` | 创建科室、管理成员、排班设置、班种管理、审批申请、查看统计 |
| **护士（普通成员）** | `isCreator = false` | 查看排班、提交期望排班、提交假勤申请、查看个人统计 |

### 2.2 权限控制逻辑

```javascript
// app.js 全局数据
globalData: {
  userInfo: null,          // 用户信息
  department: null,        // 科室信息
  isCreator: false,        // 是否为创建者（护士长）
  currentTeamId: null,     // 当前班组ID
  baseUrl: 'http://localhost:8080/api'
}

// 判断是否为护士长
isCreator = department.creatorId === userInfo.id
```

### 2.3 登录认证流程

```
1. 用户打开小程序
       │
       ▼
2. app.js onLaunch() 检查本地存储
       │
       ├── 有 userInfo ──► 恢复登录状态
       │
       └── 无 userInfo ──► 显示登录页
              │
              ▼
3. 点击"微信一键登录"
       │
       ├── 模拟模式: 直接返回模拟用户信息
       │
       └── 真实模式: 调用 wx.getUserProfile() 获取用户信息
              │
              ▼
4. 保存 token 和 userInfo 到本地存储
       │
       ▼
5. 检查是否有科室
       │
       ├── 有科室 ──► 跳转首页
       │
       └── 无科室 ──► 跳转角色选择页
              │
              ▼
6. 护士长: 创建科室 ──► 首页
   护士: 通过邀请码加入科室 ──► 首页
```

---

## 三、API 接口文档

### 3.1 用户相关接口

| 接口函数 | 后端路径 | 方法 | 功能说明 |
|----------|----------|------|----------|
| `wxLogin()` | `/user/wxLogin` | POST | 微信登录 |
| `getUserInfo()` | `/user/info` | GET | 获取用户信息 |
| `updateUserInfo(data)` | `/user/update` | PUT | 更新用户信息 |

**请求/响应示例：**

```javascript
// wxLogin
// 请求：无
// 响应：
{
  code: 0,
  success: true,
  data: {
    token: 'mock_token_123',
    id: 'user_001',
    nickName: '张护士长',
    avatarUrl: ''
  }
}

// updateUserInfo
// 请求：
{
  nickName: '新昵称',
  avatarUrl: 'https://...'
}
// 响应：
{
  code: 0,
  success: true,
  data: {
    id: 'user_001',
    nickName: '新昵称',
    avatarUrl: 'https://...'
  }
}
```

### 3.2 科室相关接口

| 接口函数 | 后端路径 | 方法 | 功能说明 |
|----------|----------|------|----------|
| `createDepartment(data)` | `/department/create` | POST | 创建科室 |
| `getDepartmentInfo()` | `/department/info` | GET | 获取科室信息 |
| `joinDepartment(data)` | `/department/join` | POST | 加入科室 |
| `dismissDepartment()` | `/department/dismiss` | DELETE | 解散科室 |
| `transferDepartment(data)` | `/department/transfer` | POST | 转让科室 |
| `getMemberList()` | `/department/members` | GET | 获取成员列表 |
| `kickMember(data)` | `/department/kick` | POST | 踢出成员 |
| `getInviteLink()` | `/department/invite` | GET | 获取邀请链接 |
| **`getMemberInfo(memberId)`** | `/department/member/${memberId}` | GET | 获取成员详情（新增） |
| **`updateMemberInfo(memberId, data)`** | `/department/member/${memberId}` | PUT | 更新成员信息（新增） |

**请求/响应示例：**

```javascript
// createDepartment
// 请求：
{
  name: '内科一病区'
}
// 响应：
{
  code: 0,
  success: true,
  data: {
    id: 'dept_001',
    name: '内科一病区',
    creatorId: 'user_001',
    memberCount: 1,
    inviteCode: 'ABC123',
    createTime: '2024-01-01'
  }
}

// joinDepartment
// 请求：
{
  inviteCode: 'ABC123'
}
// 响应：
{
  code: 0,
  success: true,
  data: {
    department: { /* 科室信息 */ }
  }
}

// transferDepartment
// 请求：
{
  newCreatorId: 'user_002'
}
// 响应：
{
  code: 0,
  success: true
}

// kickMember
// 请求：
{
  memberId: 'user_003'
}
// 响应：
{
  code: 0,
  success: true
}
```

### 3.3 班种相关接口

| 接口函数 | 后端路径 | 方法 | 功能说明 |
|----------|----------|------|----------|
| `getShiftList()` | `/shift/list` | GET | 获取班种列表 |
| `createShift(data)` | `/shift/create` | POST | 创建班种 |
| `updateShift(data)` | `/shift/update` | PUT | 更新班种 |
| `deleteShift(id)` | `/shift/delete/${id}` | DELETE | 删除班种 |

**请求/响应示例：**

```javascript
// getShiftList
// 请求：无
// 响应：
{
  code: 0,
  success: true,
  data: [
    {
      id: 'shift_001',
      code: 'A',
      name: '白班',
      timeSlots: [
        { startTime: '08:00', endTime: '16:00' }
      ],
      duration: 8,
      color: '#7BA3C8'
    },
    {
      id: 'shift_002',
      code: 'P',
      name: '中班',
      timeSlots: [
        { startTime: '16:00', endTime: '00:00+1' }
      ],
      duration: 8,
      color: '#6BAF92'
    },
    {
      id: 'shift_005',
      code: 'D',
      name: '两段班',
      timeSlots: [
        { startTime: '08:00', endTime: '12:00' },
        { startTime: '14:00', endTime: '18:00' }
      ],
      duration: 8,
      color: '#E89B7C'
    }
  ]
}

// createShift / updateShift
// 请求：
{
  code: 'A',
  name: '白班',
  timeSlots: [
    { startTime: '08:00', endTime: '16:00' }
  ],
  duration: 8,
  color: '#7BA3C8'
}
// 响应：
{
  code: 0,
  success: true,
  data: { /* 班种信息 */ }
}

// deleteShift
// 请求：/shift/delete/shift_001
// 响应：
{
  code: 0,
  success: true
}
```

**时间段次日标记说明：**
- `startTime: '16:00'` + `endTime: '00:00+1'` 表示结束时间为次日 00:00
- 例如中班：16:00 到次日 00:00

### 3.4 排班相关接口

| 接口函数 | 后端路径 | 方法 | 功能说明 |
|----------|----------|------|----------|
| `getMonthlySchedule(year, month)` | `/schedule/monthly` | GET | 获取月排班 |
| `getWeeklySchedule(startDate)` | `/schedule/weekly` | GET | 获取周排班 |
| `addSchedule(data)` | `/schedule/add` | POST | 添加排班 |
| `updateSchedule(data)` | `/schedule/update` | PUT | 更新排班 |
| `deleteSchedule(id)` | `/schedule/delete/${id}` | DELETE | 删除排班 |
| `getMySchedule(year, month)` | `/schedule/my` | GET | 获取我的排班 |

**请求/响应示例：**

```javascript
// getMonthlySchedule / getWeeklySchedule
// 请求参数：year=2024, month=3 或 startDate=2024-03-01
// 响应：
{
  code: 0,
  success: true,
  data: [
    {
      id: 'schedule_001',
      memberId: 'user_001',
      date: '2024-03-15',
      shiftId: 'shift_001',
      shiftCode: 'A',
      shiftName: '白班',
      shiftColor: '#7BA3C8'
    }
  ]
}

// addSchedule
// 请求：
{
  memberId: 'user_001',
  date: '2024-03-15',
  shiftId: 'shift_001',
  shiftCode: 'A',
  shiftName: '白班',
  shiftColor: '#7BA3C8'
}
// 响应：
{
  code: 0,
  success: true,
  data: { /* 排班信息 */ }
}

// deleteSchedule
// 请求：/schedule/delete/schedule_001
// 响应：
{
  code: 0,
  success: true
}
```

### 3.5 假勤相关接口

| 接口函数 | 后端路径 | 方法 | 功能说明 |
|----------|----------|------|----------|
| `submitLeaveApply(data)` | `/leave/apply` | POST | 提交假勤申请 |
| `getLeaveApplyList(status)` | `/leave/list` | GET | 获取所有申请列表 |
| `getMyLeaveApplyList()` | `/leave/my` | GET | 获取我的申请列表 |
| `approveLeaveApply(data)` | `/leave/approve` | POST | 审批假勤申请 |

**请求/响应示例：**

```javascript
// submitLeaveApply
// 请求：
{
  type: 'leave',          // leave-请假, transfer-调班, exchange-换班
  startDate: '2024-03-15',
  endDate: '2024-03-16',
  targetMemberId: '',     // 换班时使用
  reason: '家中有事'
}
// 响应：
{
  code: 0,
  success: true,
  data: { /* 申请信息 */ }
}

// getLeaveApplyList
// 请求参数：status=pending（可选）
// 响应：
{
  code: 0,
  success: true,
  data: [
    {
      id: 'leave_001',
      userId: 'user_002',
      userName: '李护士',
      type: 'leave',
      startDate: '2024-03-15',
      endDate: '2024-03-16',
      days: 2,
      reason: '家中有事',
      status: 'pending'    // pending-待审批, approved-已通过, rejected-已拒绝
    }
  ]
}

// approveLeaveApply
// 请求：
{
  id: 'leave_001',
  status: 'approved'      // approved 或 rejected
}
// 响应：
{
  code: 0,
  success: true
}
```

### 3.6 期望排班相关接口

| 接口函数 | 后端路径 | 方法 | 功能说明 |
|----------|----------|------|----------|
| `submitExpectSchedule(data)` | `/expect/submit` | POST | 提交期望排班 |
| `getExpectScheduleList()` | `/expect/list` | GET | 获取所有期望列表 |
| `getMyExpectSchedule()` | `/expect/my` | GET | 获取我的期望列表 |
| `approveExpectSchedule(data)` | `/expect/approve` | POST | 审批期望排班 |

**请求/响应示例：**

```javascript
// submitExpectSchedule
// 请求：
{
  shiftId: 'shift_001',
  startDate: '2024-03-20',
  endDate: '2024-03-21',
  remark: '希望上白班'
}
// 响应：
{
  code: 0,
  success: true,
  data: { /* 期望排班信息 */ }
}

// getExpectScheduleList
// 请求：无
// 响应：
{
  code: 0,
  success: true,
  data: [
    {
      id: 'expect_001',
      userId: 'user_001',
      userName: '张护士长',
      shiftId: 'shift_001',
      startDate: '2024-03-20',
      endDate: '2024-03-21',
      remark: '希望上白班',
      status: 'pending'
    }
  ]
}

// approveExpectSchedule
// 请求：
{
  id: 'expect_001',
  status: 'approved'
}
// 响应：
{
  code: 0,
  success: true
}
```

### 3.7 统计相关接口

| 接口函数 | 后端路径 | 方法 | 功能说明 |
|----------|----------|------|----------|
| `getMyStatistics(year, month)` | `/statistics/my` | GET | 获取个人统计 |
| `getDepartmentStatistics(year, month)` | `/statistics/department` | GET | 获取科室统计 |

**请求/响应示例：**

```javascript
// getMyStatistics
// 请求参数：year=2024, month=3
// 响应：
{
  code: 0,
  success: true,
  data: {
    totalDays: 22,
    leaveDays: 2,
    nightDays: 8,
    shiftDetails: [
      { name: '白班', color: '#7BA3C8', count: 10 },
      { name: '中班', color: '#6BAF92', count: 4 },
      { name: '夜班', color: '#9B8AA8', count: 8 }
    ]
  }
}

// getDepartmentStatistics
// 请求参数：year=2024, month=3
// 响应：
{
  code: 0,
  success: true,
  data: {
    totalSchedules: 110,
    totalMembers: 5,
    avgDays: 22,
    memberRank: [
      { id: 'user_001', name: '张护士长', days: 24 },
      { id: 'user_002', name: '李护士', days: 23 },
      { id: 'user_003', name: '王护士', days: 22 },
      { id: 'user_004', name: '赵护士', days: 21 },
      { id: 'user_005', name: '刘护士', days: 20 }
    ]
  }
}
```

---

## 四、数据结构定义

### 4.1 用户信息 (User)

```javascript
{
  id: 'user_001',           // 用户ID
  nickName: '张护士长',      // 昵称
  avatarUrl: ''             // 头像URL
}
```

### 4.2 科室信息 (Department)

```javascript
{
  id: 'dept_001',           // 科室ID
  name: '内科一病区',         // 科室名称
  creatorId: 'user_001',    // 创建者ID（护士长）
  memberCount: 5,           // 成员数量
  inviteCode: 'ABC123',     // 邀请码
  createTime: '2024-01-01'  // 创建时间
}
```

### 4.3 成员信息 (Member) - **已扩展字段**

```javascript
{
  id: 'user_001',           // 成员ID
  nickName: '张护士',        // 昵称
  avatarUrl: '',            // 头像URL
  joinTime: '2024-01-01',   // 加入时间
  phone: '13800138001',     // 电话号码（用于拨打）
  workNo: 'N001',           // 工号
  title: '护士长',          // 职称
  seniority: 10,            // 年资（年）
  remark: '',               // 备注
  isCreator: false          // 是否为创建者
}
```

### 4.4 班种信息 (Shift)

```javascript
{
  id: 'shift_001',          // 班种ID
  code: 'A',                // 班种编号（显示在日历上）
  name: '白班',             // 班种名称
  timeSlots: [              // 时间段数组（支持多段班）
    {
      startTime: '08:00',   // 开始时间
      endTime: '16:00',     // 结束时间
      startIsNextDay: false,// 开始是否次日
      endIsNextDay: false   // 结束是否次日
    }
  ],
  duration: 8,              // 时长（小时）
  color: '#7BA3C8'          // 显示颜色
}
```

**时间段次日标记说明：**
- `startTime: '16:00'` + `endIsNextDay: true` 表示结束时间为次日
- 例如中班：`16:00` 到次日 `00:00`，表示为 `{startTime: '16:00', endTime: '00:00+1'}`

### 4.5 排班信息 (Schedule)

```javascript
{
  id: 'schedule_001',       // 排班ID
  memberId: 'user_001',     // 成员ID
  date: '2024-03-15',       // 日期
  shiftId: 'shift_001',     // 班种ID
  shiftCode: 'A',           // 班种编号
  shiftName: '白班',        // 班种名称
  shiftColor: '#7BA3C8'     // 班种颜色
}
```

### 4.6 假勤申请 (LeaveApply)

```javascript
{
  id: 'leave_001',          // 申请ID
  userId: 'user_002',       // 申请人ID
  userName: '李护士',       // 申请人姓名
  type: 'leave',            // 类型：leave-请假, transfer-调班, exchange-换班
  startDate: '2024-03-15',  // 开始日期
  endDate: '2024-03-16',    // 结束日期
  days: 2,                  // 天数
  targetMemberId: '',       // 换班对象ID（换班时使用）
  reason: '家中有事',       // 事由
  status: 'pending'         // 状态：pending-待审批, approved-已通过, rejected-已拒绝
}
```

### 4.7 期望排班 (ExpectSchedule)

```javascript
{
  id: 'expect_001',         // 期望ID
  userId: 'user_001',       // 申请人ID
  userName: '张护士长',     // 申请人姓名
  shiftId: 'shift_001',     // 期望班种ID
  startDate: '2024-03-20',  // 开始日期
  endDate: '2024-03-21',    // 结束日期
  remark: '希望上白班',     // 备注
  status: 'pending'         // 状态：pending-待审批, approved-已通过, rejected-已拒绝
}
```

### 4.8 统计数据 (Statistics)

```javascript
// 个人统计
{
  totalDays: 22,            // 总工作天数
  leaveDays: 2,             // 请假天数
  nightDays: 8,             // 夜班天数
  shiftDetails: [           // 各班种详情
    { name: '白班', color: '#7BA3C8', count: 10 },
    { name: '中班', color: '#6BAF92', count: 4 },
    { name: '夜班', color: '#9B8AA8', count: 8 }
  ]
}

// 科室统计
{
  totalSchedules: 110,      // 总排班数
  totalMembers: 5,          // 总成员数
  avgDays: 22,              // 平均工作天数
  memberRank: [             // 成员排名
    { id: 'user_001', name: '张护士长', days: 24 },
    { id: 'user_002', name: '李护士', days: 23 }
  ]
}
```

---

## 五、全局配置

### 5.1 app.js 全局数据和方法

```javascript
App({
  globalData: {
    userInfo: null,          // 用户信息
    department: null,        // 科室信息
    isCreator: false,        // 是否为创建者（护士长）
    currentTeamId: null,     // 当前班组ID（预留字段）
    baseUrl: 'http://localhost:8080/api'  // 后端接口地址
  },

  // 方法
  checkLoginStatus() {},     // 检查登录状态
  setUserInfo(userInfo) {},  // 设置用户信息
  setDepartment(dept) {},    // 设置科室信息
  clearUserInfo() {},        // 清除用户信息（退出登录）
  hasDepartment() {},        // 检查是否有科室
  isLeader() {}              // 判断是否为护士长
});
```

### 5.2 app.json 配置

```json
{
  "pages": [
    "pages/login/login",
    "pages/role-select/role-select",
    "pages/index/index",
    "pages/create-department/create-department",
    "pages/department-manage/department-manage",
    "pages/member-list/member-list",
    "pages/shift-manage/shift-manage",
    "pages/create-shift/create-shift",
    "pages/schedule/schedule",
    "pages/approval/approval",
    "pages/statistics/statistics",
    "pages/expect-schedule/expect-schedule",
    "pages/leave-apply/leave-apply",
    "pages/print-schedule/print-schedule"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#4A90D9",
    "navigationBarTitleText": "护士排班",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#F5F7FA"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

**注意：** 项目未配置 tabBar，所有导航通过页面跳转实现。

### 5.3 工具函数 (utils/util.js)

| 函数名 | 功能说明 |
|--------|----------|
| `formatDate(date, format)` | 格式化日期 |
| `getDaysInMonth(year, month)` | 获取月份天数 |
| `getFirstDayOfMonth(year, month)` | 获取月份第一天是周几 |
| `generateCalendarData(year, month)` | 生成日历数据 |
| `isToday(year, month, day)` | 判断是否为今天 |
| `getWeekRange(date)` | 获取本周日期范围 |
| `showLoading(title)` | 显示加载提示 |
| `hideLoading()` | 隐藏加载提示 |
| `showSuccess(title)` | 显示成功提示 |
| `showError(title)` | 显示错误提示 |
| `showConfirm(title, content)` | 显示确认弹窗 |
| `deepClone(obj)` | 深拷贝 |
| `debounce(fn, delay)` | 防抖函数 |

---

## 六、新增功能详解

### 6.1 成员信息详情页

**功能说明**：
- 展示成员完整个人信息
- 支持本人编辑个人资料
- 包含头像、姓名、电话、工号、职称、年资、备注等字段

**权限控制**：
- 仅本人可编辑自己的信息
- 其他字段为只读展示

**可编辑字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| nickName | 文本 | 姓名 |
| phone | 数字 | 电话号码 |
| workNo | 文本 | 工号 |
| title | 文本 | 职称 |
| seniority | 数字 | 年资（年） |
| remark | 多行文本 | 备注 |

### 6.2 头像点击拨打电话功能

**实现位置**：首页成员列表

**功能逻辑**：
```javascript
// 点击头像事件
onAvatarTap(e) {
  const { id, phone, isself } = e.currentTarget.dataset;
  
  if (isself) {
    // 是本人，跳转到用户信息详情页
    wx.navigateTo({ url: `/pages/member-info/member-info?memberId=${id}` });
  } else {
    // 不是本人，拨打电话
    if (!phone) {
      wx.showToast({ title: '暂无电话号码', icon: 'none' });
      return;
    }
    
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: (err) => {
        if (err.errMsg !== 'makePhoneCall:fail cancel') {
          wx.showToast({ title: '拨打失败', icon: 'none' });
        }
      }
    });
  }
}
```

**WXML实现**：
```html
<view 
  class="member-avatar-text" 
  catchtap="onAvatarTap"
  data-id="{{item.id}}"
  data-phone="{{item.phone}}"
  data-isself="{{item.isSelf}}"
>
  <text>{{item.nickName[0]}}</text>
</view>
```

### 6.3 成员列表标签显示

**标签类型**：
- **"我"标签**：橙色背景 `#FFF7E6`，橙色文字 `#FA8C16`，标识当前登录用户
- **"创建者"标签**：蓝色背景 `#E8F4FD`，蓝色文字 `#4A90D9`，标识科室创建者

**显示逻辑**：
- 如果是本人且是创建者：显示"我"和"创建者"两个标签
- 如果只是本人：显示"我"标签
- 如果只是创建者：显示"创建者"标签
- 其他成员：不显示标签

---

## 七、项目特点

### 7.1 技术特点

- **模拟数据模式**：支持本地开发调试，可快速切换至真实后端
- **多时间段班种**：支持两段班等复杂班次类型
- **跨天班次支持**：次日标记 `+1` 表示跨天时间
- **日历滑动切换**：Swiper 组件实现月份平滑切换

### 7.2 业务特点

- **清晰的角色权限**：护士长/护士权限明确划分
- **完整的排班流程**：班种管理 → 排班设置 → 发布
- **审批机制**：期望排班和假勤申请审批流程
- **数据统计**：个人和科室维度的排班统计
- **便捷沟通**：头像点击拨打电话，快速联系同事
- **个人信息管理**：支持用户编辑维护个人资料

### 7.3 待完善功能

- 假勤申请入口已注释（代码中存在但未启用）
- 打印功能使用截图提示，未实现真正的 Canvas 导出
- 部分统计 API 需要支持按成员 ID 查询

---

## 八、后端接口规范

### 7.1 请求头

```javascript
{
  'Content-Type': 'application/json',
  'Authorization': wx.getStorageSync('token') || ''
}
```

### 7.2 响应格式

```javascript
// 成功响应
{
  code: 0,
  success: true,
  data: { /* 数据 */ }
}

// 失败响应
{
  code: 1,
  success: false,
  message: '错误信息'
}
```

### 7.3 错误码处理

- `200` - 请求成功
- `401` - 未授权，跳转登录页
- `其他` - 显示错误提示

---

## 九、开发指南

### 8.1 环境要求

- 微信开发者工具
- Node.js（可选，用于后端开发）

### 8.2 运行项目

1. 使用微信开发者工具打开 `mini` 目录
2. 项目会自动加载，默认使用模拟数据
3. 切换真实后端：修改 `utils/api.js` 中的 `USE_MOCK = false`

### 8.3 目录结构

```
mini/
├── pages/              # 页面文件
│   ├── login/          # 登录页
│   ├── index/          # 首页
│   ├── schedule/       # 排班设置页
│   ├── shift-manage/   # 班种管理页
│   └── ...
├── utils/              # 工具函数
│   ├── api.js          # API 接口封装
│   └── util.js         # 通用工具函数
├── images/             # 图片资源
├── app.js              # 小程序入口
├── app.json            # 小程序配置
├── app.wxss            # 全局样式
└── project.config.json # 项目配置
```

---

## 十、版本信息

- **版本号**：1.1.0
- **更新时间**：2024-03-27
- **开发状态**：开发中

**更新日志**：
- ✅ 新增成员信息详情页
- ✅ 新增头像点击拨打电话功能
- ✅ 新增成员列表"我"标签显示
- ✅ 扩展成员信息字段（电话、工号、职称、年资、备注）
- ✅ 新增获取/更新成员信息接口
