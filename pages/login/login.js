// pages/login/login.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    loading: false,
    inviteCode: null  // 邀请码
  },

  onLoad(options) {
    // 获取邀请码参数
    if (options.inviteCode) {
      this.setData({ inviteCode: options.inviteCode });
      console.log('获取到邀请码:', options.inviteCode);
    }
    
    // 检查是否已登录
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.redirectToNext();
    } else if (this.data.inviteCode) {
      // 有邀请码但未登录，自动登录
      this.handleLogin();
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
        code: code
      };
      
      // 只有用户主动授权获取到了信息，才传递给后端
      if (userInfo?.nickName) {
        loginData.nickName = userInfo.nickName;
      }
      if (userInfo?.avatarUrl) {
        loginData.avatarUrl = userInfo.avatarUrl;
      }

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
    const { inviteCode } = this.data;

    if (department) {
      // 有科室，直接进入首页
      wx.reLaunch({ url: '/pages/index/index' });
    } else {
      // 无科室，进入身份选择页
      let url = '/pages/role-select/role-select';
      if (inviteCode) {
        // 如果有邀请码，传递给身份选择页
        url += `?inviteCode=${inviteCode}`;
      }
      wx.reLaunch({ url });
    }
  },

  // 跳过登录，直接进入首页
  skipLogin() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
