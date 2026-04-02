// pages/login/login.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    loading: false
  },

  onLoad(options) {
    // 检查是否已登录
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.redirectToNext();
    }
  },

  // 处理登录
  async handleLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });
    util.showLoading('登录中...');

    try {
      // 1. 获取微信登录code
      const loginRes = await this.getWxCode();
      const code = loginRes.code;

      // 2. 获取用户信息（可选，用于更新头像昵称）
      let userInfo = null;
      try {
        userInfo = await this.getUserProfile();
      } catch (e) {
        // 用户拒绝授权用户信息，使用默认值
      }

      // 3. 调用后端登录接口
      const loginData = {
        code: code,
        nickName: userInfo?.nickName || '微信用户',
        avatarUrl: userInfo?.avatarUrl || ''
      };

      const res = await api.wxLogin(loginData);

      // 4. 保存token和用户信息
      wx.setStorageSync('token', res.data.token);
      const user = {
        id: res.data.id,
        nickName: res.data.nickName,
        avatarUrl: res.data.avatarUrl
      };
      app.setUserInfo(user);

      // 5. 如果后端返回了科室信息，保存科室信息
      if (res.data.department) {
        app.setDepartment(res.data.department);
      }

      util.hideLoading();
      util.showSuccess('登录成功');

      // 6. 跳转下一页
      setTimeout(() => {
        this.redirectToNext();
      }, 1000);

    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '登录失败，请重试');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 获取微信登录code
  getWxCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
  },

  // 获取用户信息（可选）
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          resolve({
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl
          });
        },
        fail: reject
      });
    });
  },

  // 跳转到下一页
  redirectToNext() {
    const department = wx.getStorageSync('department');

    if (department) {
      // 有科室，直接进入首页
      wx.redirectTo({ url: '/pages/index/index' });
    } else {
      // 无科室，进入身份选择页
      wx.redirectTo({ url: '/pages/role-select/role-select' });
    }
  }
});
