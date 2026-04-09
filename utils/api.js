// utils/api.js - API接口封装

const app = getApp();

// ========== 模拟数据开关 ==========
// 设置为 true 使用模拟数据，false 连接真实后端
const USE_MOCK = false;

// ========== 模拟数据 ==========
const MOCK_DATA = {
  // 模拟用户信息
  userInfo: {
    id: 'user_001',
    nickName: '张护士长',
    avatarUrl: ''
  },

  // 模拟科室信息
  department: {
    id: 'dept_001',
    name: '内科一病区',
    creatorId: 'user_001',
    memberCount: 6,
    inviteCode: 'ABC123',
    createTime: '2024-01-01'
  },

  // 模拟成员列表
  members: [
    { id: 'user_001', nickName: '张护士', avatarUrl: '', joinTime: '2024-01-01', phone: '13800138001', workNo: 'N001', title: '护士长', seniority: 10, remark: '' },
    { id: 'user_002', nickName: '李护士', avatarUrl: '', joinTime: '2024-01-02', phone: '13800138002', workNo: 'N002', title: '主管护士', seniority: 8, remark: '' },
    { id: 'user_003', nickName: '王护士', avatarUrl: '', joinTime: '2024-01-03', phone: '13800138003', workNo: 'N003', title: '护士', seniority: 5, remark: '' },
    { id: 'user_004', nickName: '赵护士', avatarUrl: '', joinTime: '2024-01-04', phone: '13800138004', workNo: 'N004', title: '护士', seniority: 3, remark: '' },
    { id: 'user_005', nickName: '刘护士', avatarUrl: '', joinTime: '2024-01-05', phone: '13800138005', workNo: 'N005', title: '护士', seniority: 2, remark: '' },
    { id: 'user_006', nickName: '陈护士', avatarUrl: '', joinTime: '2024-01-06', phone: '13800138006', workNo: 'N006', title: '护师', seniority: 4, remark: '负责ICU护理工作' }
  ],

  // 模拟班种列表
  shifts: [
    { id: 'shift_001', code: 'A', name: '白班', timeSlots: [{startTime: '08:00', endTime: '16:00'}], duration: 8, color: '#7BA3C8' },
    { id: 'shift_002', code: 'P', name: '中班', timeSlots: [{startTime: '16:00', endTime: '00:00+1'}], duration: 8, color: '#6BAF92' },
    { id: 'shift_003', code: 'N', name: '夜班', timeSlots: [{startTime: '00:00', endTime: '08:00'}], duration: 8, color: '#9B8AA8' },
    { id: 'shift_004', code: '休', name: '休息', timeSlots: [{startTime: '00:00', endTime: '00:00'}], duration: 0, color: '#A8B5BD' },
    { id: 'shift_005', code: 'D', name: '两段班', timeSlots: [{startTime: '08:00', endTime: '12:00'}, {startTime: '14:00', endTime: '18:00'}], duration: 8, color: '#E89B7C' }
  ],

  // 模拟排班数据
  schedules: [],

  // 模拟假勤申请
  leaveApplies: [
    {
      id: 'leave_001',
      userId: 'user_002',
      userName: '李护士',
      type: 'leave',
      startDate: '2024-03-15',
      endDate: '2024-03-16',
      days: 2,
      reason: '家中有事',
      status: 'pending'
    }
  ],

  // 模拟期望排班
  expectSchedules: [
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
  ],

  // 模拟统计数据
  statistics: {
    myStats: {
      totalDays: 22,
      restDays: 8,
      leaveDays: 2,
      shiftDetails: [
        { name: '白班', code: 'A', color: '#7BA3C8', count: 10 },
        { name: '中班', code: 'P', color: '#6BAF92', count: 4 },
        { name: '夜班', code: 'N', color: '#9B8AA8', count: 8 }
      ]
    },
    deptStats: {
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
};

// 本地存储模拟数据
let localShifts = [...MOCK_DATA.shifts];
let localSchedules = [...MOCK_DATA.schedules];
let localLeaveApplies = [...MOCK_DATA.leaveApplies];
let localExpectSchedules = [...MOCK_DATA.expectSchedules];

// ========== 模拟请求函数 ==========
const mockRequest = (apiName, data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ code: 0, success: true, data: getMockData(apiName, data) });
    }, 200);
  });
};

// 获取模拟数据
const getMockData = (apiName, data) => {
  switch (apiName) {
    // 用户相关
    case 'wxLogin':
      return { token: 'mock_token_123', ...MOCK_DATA.userInfo };
    case 'getUserInfo':
      return MOCK_DATA.userInfo;
    case 'updateUserInfo':
      return { ...MOCK_DATA.userInfo, ...data };

    // 科室相关
    case 'createDepartment':
      const newDept = {
        id: 'dept_' + Date.now(),
        ...data,
        creatorId: MOCK_DATA.userInfo.id,
        memberCount: 1,
        inviteCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
        createTime: new Date().toISOString().split('T')[0]
      };
      MOCK_DATA.department = newDept;
      return newDept;
    case 'getDepartmentInfo':
      return MOCK_DATA.department;
    case 'joinDepartment':
      return { department: MOCK_DATA.department };
    case 'dismissDepartment':
      return { success: true };
    case 'transferDepartment':
      MOCK_DATA.department.creatorId = data.newCreatorId;
      return { success: true };
    case 'getMemberList':
      return MOCK_DATA.members;
    case 'kickMember':
      MOCK_DATA.members = MOCK_DATA.members.filter(m => m.id !== data.memberId);
      return { success: true };
    case 'getInviteLink':
      return { inviteCode: MOCK_DATA.department.inviteCode };
    case 'getMemberInfo':
      return MOCK_DATA.members.find(m => m.id === data) || {};
    case 'updateMemberInfo':
      MOCK_DATA.members = MOCK_DATA.members.map(m => 
        m.id === data.memberId ? { ...m, ...data.info } : m
      );
      return { success: true };

    // 班种相关
    case 'getShiftList':
      return localShifts;
    case 'createShift':
      const newShift = {
        id: 'shift_' + Date.now(),
        ...data
      };
      localShifts.push(newShift);
      return newShift;
    case 'updateShift':
      localShifts = localShifts.map(s => s.id === data.id ? { ...s, ...data } : s);
      return { success: true };
    case 'deleteShift':
      localShifts = localShifts.filter(s => s.id !== data);
      return { success: true };

    // 排班相关
    case 'getMonthlySchedule':
    case 'getMySchedule':
      return localSchedules;
    case 'getWeeklySchedule':
      return localSchedules;
    case 'addSchedule':
      const newSchedule = {
        id: 'schedule_' + Date.now(),
        ...data
      };
      localSchedules.push(newSchedule);
      return newSchedule;
    case 'updateSchedule':
      localSchedules = localSchedules.map(s => s.id === data.id ? { ...s, ...data } : s);
      return { success: true };
    case 'deleteSchedule':
      localSchedules = localSchedules.filter(s => s.id !== data);
      return { success: true };

    // 假勤相关
    case 'submitLeaveApply':
      const newLeave = {
        id: 'leave_' + Date.now(),
        userId: MOCK_DATA.userInfo.id,
        userName: MOCK_DATA.userInfo.nickName,
        ...data,
        status: 'pending'
      };
      localLeaveApplies.push(newLeave);
      return newLeave;
    case 'getLeaveApplyList':
      return localLeaveApplies;
    case 'getMyLeaveApplyList':
      return localLeaveApplies.filter(l => l.userId === MOCK_DATA.userInfo.id);
    case 'approveLeaveApply':
      localLeaveApplies = localLeaveApplies.map(l => 
        l.id === data.id ? { ...l, status: data.status } : l
      );
      return { success: true };

    // 期望排班相关
    case 'submitExpectSchedule':
      const newExpect = {
        id: 'expect_' + Date.now(),
        userId: MOCK_DATA.userInfo.id,
        userName: MOCK_DATA.userInfo.nickName,
        ...data,
        status: 'pending'
      };
      localExpectSchedules.push(newExpect);
      return newExpect;
    case 'getExpectScheduleList':
      return localExpectSchedules;
    case 'getMyExpectSchedule':
      return localExpectSchedules.filter(e => e.userId === MOCK_DATA.userInfo.id);
    case 'approveExpectSchedule':
      localExpectSchedules = localExpectSchedules.map(e => 
        e.id === data.id ? { ...e, status: data.status } : e
      );
      return { success: true };

    // 统计相关
    case 'getMyStatistics':
      return MOCK_DATA.statistics.myStats;
    case 'getDepartmentStatistics':
      return MOCK_DATA.statistics.deptStats;

    default:
      return null;
  }
};

// ========== 真实请求函数 ==========
const realRequest = (options) => {
  return new Promise((resolve, reject) => {
    const { url, method = 'GET', data = {}, params = {}, header = {} } = options;

    // 构建URL参数（params 用于 URL 查询参数，data 用于请求体）
    let requestUrl = app.globalData.baseUrl + url;
    if (Object.keys(params).length > 0) {
      const queryString = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
      if (queryString) {
        requestUrl += '?' + queryString;
      }
    }

    // GET 请求：data 作为 URL 参数
    if (method === 'GET' && Object.keys(data).length > 0) {
      const queryString = Object.keys(data)
        .filter(key => data[key] !== undefined && data[key] !== null && data[key] !== '')
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
        .join('&');
      if (queryString) {
        requestUrl += (requestUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    wx.request({
      url: requestUrl,
      method,
      data: method === 'GET' ? {} : data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': wx.getStorageSync('token') || '',
        ...header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          if (res.data.code === 0 || res.data.success) {
            resolve(res.data);
          } else {
            reject(res.data);
          }
        } else if (res.statusCode === 401) {
          app.clearUserInfo();
          // 不自动跳转到登录页，让页面自己处理未登录状态
          reject(res.data);
        } else {
          reject(res.data);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

// ========== 统一请求函数 ==========
const request = (options) => {
  if (USE_MOCK) {
    return mockRequest(options.url, options.data);
  }
  return realRequest(options);
};

// 获取当前科室ID的辅助函数
const getCurrentDepartmentId = () => {
  return app.globalData.currentTeamId || app.globalData.department?.id || null;
};

// ========== 用户相关接口 ==========

const wxLogin = (data) => {
  if (USE_MOCK) return mockRequest('wxLogin', data);
  return request({ url: '/user/wxLogin', method: 'POST', data });
};

const getUserInfo = () => {
  if (USE_MOCK) return mockRequest('getUserInfo');
  return request({ url: '/user/info' });
};

const updateUserInfo = (data) => {
  if (USE_MOCK) return mockRequest('updateUserInfo', data);
  return request({ url: '/user/update', method: 'PUT', data });
};

// ========== 科室相关接口 ==========

const createDepartment = (data) => {
  if (USE_MOCK) return mockRequest('createDepartment', data);
  return request({ url: '/department/create', method: 'POST', data });
};

const getDepartmentInfo = (departmentId) => {
  if (USE_MOCK) return mockRequest('getDepartmentInfo');
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/department/info', data: { departmentId: deptId } });
};

const joinDepartment = (data) => {
  if (USE_MOCK) return mockRequest('joinDepartment', data);
  return request({ url: '/department/join', method: 'POST', data });
};

const dismissDepartment = (departmentId) => {
  if (USE_MOCK) return mockRequest('dismissDepartment');
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/department/dismiss', method: 'DELETE', params: { departmentId: deptId } });
};

const transferDepartment = (departmentId, data) => {
  if (USE_MOCK) return mockRequest('transferDepartment', data);
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/department/transfer', method: 'POST', data, params: { departmentId: deptId } });
};

const getMemberList = (departmentId) => {
  if (USE_MOCK) return mockRequest('getMemberList');
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/department/members', data: { departmentId: deptId } });
};

const kickMember = (departmentId, data) => {
  if (USE_MOCK) return mockRequest('kickMember', data);
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/department/kick', method: 'POST', data, params: { departmentId: deptId } });
};

const getInviteLink = (departmentId) => {
  if (USE_MOCK) return mockRequest('getInviteLink');
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/department/invite', data: { departmentId: deptId } });
};

const getMemberInfo = (memberId) => {
  if (USE_MOCK) return mockRequest('getMemberInfo', memberId);
  return request({ url: `/department/member/${memberId}` });
};

const updateMemberInfo = (memberId, data) => {
  if (USE_MOCK) return mockRequest('updateMemberInfo', { memberId, info: data });
  return request({ url: `/department/member/${memberId}`, method: 'PUT', data });
};

const quitDepartment = (departmentId) => {
  if (USE_MOCK) return mockRequest('quitDepartment');
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/department/quit', method: 'POST', params: { departmentId: deptId } });
};

// ========== 班种相关接口 ==========

const getShiftList = (departmentId) => {
  if (USE_MOCK) return mockRequest('getShiftList');
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/shift/list', data: { departmentId: deptId } });
};

const createShift = (departmentId, data) => {
  if (USE_MOCK) return mockRequest('createShift', data);
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/shift/create', method: 'POST', data, params: { departmentId: deptId } });
};

const updateShift = (data) => {
  if (USE_MOCK) return mockRequest('updateShift', data);
  return request({ url: '/shift/update', method: 'PUT', data });
};

const deleteShift = (id) => {
  if (USE_MOCK) return mockRequest('deleteShift', id);
  return request({ url: `/shift/delete/${id}`, method: 'DELETE' });
};

// ========== 排班相关接口 ==========

const getMonthlySchedule = (departmentId, year, month) => {
  if (USE_MOCK) return mockRequest('getMonthlySchedule', { year, month });
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/schedule/monthly', data: { departmentId: deptId, year, month } });
};

const getWeeklySchedule = (departmentId, startDate) => {
  if (USE_MOCK) return mockRequest('getWeeklySchedule', { startDate });
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/schedule/weekly', data: { departmentId: deptId, startDate } });
};

const addSchedule = (departmentId, data) => {
  if (USE_MOCK) return mockRequest('addSchedule', data);
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/schedule/add', method: 'POST', data, params: { departmentId: deptId } });
};

/**
 * 批量操作排班（添加和删除）
 * @param {string} departmentId 科室ID
 * @param {object} data { adds: [], deletes: [] }
 */
const batchSchedule = (departmentId, data) => {
  if (USE_MOCK) return mockRequest('batchSchedule', data);
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/schedule/batch', method: 'POST', data, params: { departmentId: deptId } });
};

const updateSchedule = (data) => {
  if (USE_MOCK) return mockRequest('updateSchedule', data);
  return request({ url: '/schedule/update', method: 'PUT', data });
};

const deleteSchedule = (id) => {
  if (USE_MOCK) return mockRequest('deleteSchedule', id);
  return request({ url: `/schedule/delete/${id}`, method: 'DELETE' });
};

const getMySchedule = (yearMonths) => {
  if (USE_MOCK) return mockRequest('getMySchedule', { yearMonths });
  // yearMonths 可以是数组或逗号分隔的字符串
  const yearMonthsStr = Array.isArray(yearMonths) ? yearMonths.join(',') : yearMonths;
  return request({ url: '/schedule/my', data: { yearMonths: yearMonthsStr } });
};

// ========== 假勤相关接口 ==========

const submitLeaveApply = (data) => {
  if (USE_MOCK) return mockRequest('submitLeaveApply', data);
  return request({ url: '/leave/apply', method: 'POST', data });
};

const getLeaveApplyList = (status) => {
  if (USE_MOCK) return mockRequest('getLeaveApplyList', { status });
  return request({ url: '/leave/list', data: { status } });
};

const getMyLeaveApplyList = () => {
  if (USE_MOCK) return mockRequest('getMyLeaveApplyList');
  return request({ url: '/leave/my' });
};

const approveLeaveApply = (data) => {
  if (USE_MOCK) return mockRequest('approveLeaveApply', data);
  return request({ url: '/leave/approve', method: 'POST', data });
};

// ========== 期望排班相关接口 ==========

const submitExpectSchedule = (data) => {
  if (USE_MOCK) return mockRequest('submitExpectSchedule', data);
  return request({ url: '/expect/submit', method: 'POST', data });
};

const getExpectScheduleList = () => {
  if (USE_MOCK) return mockRequest('getExpectScheduleList');
  return request({ url: '/expect/list' });
};

const getMyExpectSchedule = () => {
  if (USE_MOCK) return mockRequest('getMyExpectSchedule');
  return request({ url: '/expect/my' });
};

const approveExpectSchedule = (data) => {
  if (USE_MOCK) return mockRequest('approveExpectSchedule', data);
  return request({ url: '/expect/approve', method: 'POST', data });
};

const getPendingCount = () => {
  if (USE_MOCK) return mockRequest('getPendingCount');
  return request({ url: '/expect/pending-count' });
};

const getApprovedExpectByUsers = (userIds) => {
  if (USE_MOCK) return mockRequest('getApprovedExpectByUsers', userIds);
  return request({ url: '/expect/approved-by-users', method: 'POST', data: userIds });
};

const getUsersByDate = (date) => {
  if (USE_MOCK) return mockRequest('getUsersByDate', { date });
  return request({ url: '/swap/users-by-date', data: { date } });
};

const submitSwapRequest = (data) => {
  if (USE_MOCK) return mockRequest('submitSwapRequest', data);
  return request({ url: '/swap/submit', method: 'POST', data });
};

// ========== 统计相关接口 ==========

const getMyStatistics = (year, month) => {
  if (USE_MOCK) return mockRequest('getMyStatistics', { year, month });
  return request({ url: '/statistics/my', data: { year, month } });
};

const getDepartmentStatistics = (year, month, departmentId) => {
  if (USE_MOCK) return mockRequest('getDepartmentStatistics', { year, month });
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/statistics/department', data: { departmentId: deptId, year, month } });
};

// ========== 班种套餐相关接口 ==========

const getShiftPackageList = (departmentId) => {
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/package/list', data: { departmentId: deptId } });
};

const createShiftPackage = (departmentId, data) => {
  const deptId = departmentId || getCurrentDepartmentId();
  if (!deptId) {
    return Promise.reject({ message: '科室ID不存在' });
  }
  return request({ url: '/package/create', method: 'POST', data, params: { departmentId: deptId } });
};

const updateShiftPackage = (data) => {
  return request({ url: '/package/update', method: 'PUT', data });
};

const deleteShiftPackage = (id) => {
  return request({ url: `/package/delete/${id}`, method: 'DELETE' });
};

module.exports = {
  request,
  USE_MOCK,
  // 用户相关
  wxLogin,
  getUserInfo,
  updateUserInfo,
  // 科室相关
  createDepartment,
  getDepartmentInfo,
  joinDepartment,
  dismissDepartment,
  transferDepartment,
  getMemberList,
  kickMember,
  getInviteLink,
  getMemberInfo,
  updateMemberInfo,
  // 班种相关
  getShiftList,
  createShift,
  updateShift,
  deleteShift,
  // 排班相关
  getMonthlySchedule,
  getWeeklySchedule,
  addSchedule,
  batchSchedule,
  updateSchedule,
  deleteSchedule,
  getMySchedule,
  // 假勤相关
  submitLeaveApply,
  getLeaveApplyList,
  getMyLeaveApplyList,
  approveLeaveApply,
  // 期望排班相关
  submitExpectSchedule,
  getExpectScheduleList,
  getMyExpectSchedule,
  approveExpectSchedule,
  getPendingCount,
  getApprovedExpectByUsers,
  // 换班相关
  getUsersByDate,
  submitSwapRequest,
  // 统计相关
  getMyStatistics,
  getDepartmentStatistics,
  // 班种套餐相关
  getShiftPackageList,
  createShiftPackage,
  updateShiftPackage,
  deleteShiftPackage,
  // 退出科室
  quitDepartment
};
