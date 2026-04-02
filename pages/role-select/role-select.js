// pages/role-select/role-select.js
const app = getApp();

Page({
  data: {},

  onLoad(options) {
    // 检查是否有邀请参数（护士通过邀请链接进入）
    if (options.inviteCode) {
      this.handleInvite(options.inviteCode);
    }
  },

  // 选择护士长身份
  selectLeader() {
    app.setRole('leader');
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // 选择护士身份
  selectNurse() {
    app.setRole('nurse');
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // 处理邀请
  handleInvite(inviteCode) {
    wx.showModal({
      title: '加入科室',
      content: '检测到邀请信息，是否加入该科室？',
      success: (res) => {
        if (res.confirm) {
          this.joinDepartment(inviteCode);
        }
      }
    });
  },

  // 加入科室
  async joinDepartment(inviteCode) {
    const api = require('../../utils/api');
    const util = require('../../utils/util');

    try {
      util.showLoading('加入中...');
      const res = await api.joinDepartment({ inviteCode });
      util.hideLoading();

      app.setDepartment(res.data);
      util.showSuccess('加入成功');

      setTimeout(() => {
        wx.redirectTo({ url: '/pages/index/index' });
      }, 1000);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '加入失败');
    }
  }
});
