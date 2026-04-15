// app.js - 护士排班小程序入口文件
App({
  globalData: {
    userInfo: null,          // 用户信息
    department: null,        // 科室信息
    isCreator: false,        // 是否为创建者（护士长）
    isAdmin: false,          // 是否为管理员
    role: null,              // 用户角色：'leader' 或 'nurse'
    currentTeamId: null,     // 当前班组ID
    tempNewShift: null,      // 临时存储新班种数据（用于创建科室时）
    baseUrl: 'https://localhost:8080/api',  // 后端接口地址
  },

  onLaunch() {
    // 检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const department = wx.getStorageSync('department');
    const role = wx.getStorageSync('role');
    
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.department = department;
      this.globalData.role = role || null;
      this.globalData.isCreator = department ? department.creatorId === userInfo.id : false;
      // 恢复 currentTeamId
      if (department && department.id) {
        this.globalData.currentTeamId = department.id;
      }
    }
  },

  // 设置用户信息
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', userInfo);
  },

  // 设置角色
  setRole(role) {
    this.globalData.role = role;
    wx.setStorageSync('role', role);
  },

  // 获取角色
  getRole() {
    return this.globalData.role;
  },

  // 设置科室信息
  setDepartment(department) {
    this.globalData.department = department;
    this.globalData.isCreator = department ? department.creatorId === this.globalData.userInfo?.id : false;
    // 设置 currentTeamId
    if (department && department.id) {
      this.globalData.currentTeamId = department.id;
    }
    wx.setStorageSync('department', department);
  },

  // 设置管理员状态
  setAdmin(isAdmin) {
    this.globalData.isAdmin = isAdmin;
  },

  // 清除用户信息（退出登录）
  clearUserInfo() {
    this.globalData.userInfo = null;
    this.globalData.department = null;
    this.globalData.isCreator = false;
    this.globalData.isAdmin = false;
    this.globalData.role = null;
    this.globalData.currentTeamId = null;
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('department');
    wx.removeStorageSync('role');
  },

  // 检查是否有科室
  hasDepartment() {
    return !!this.globalData.department;
  },

  // 判断是否为护士长（创建者或管理员）
  isLeader() {
    return this.globalData.isCreator || this.globalData.isAdmin;
  }
});
