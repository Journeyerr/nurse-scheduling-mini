// pages/member-list/member-list.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    isLeader: false,
    members: [],
    filteredMembers: [],
    keyword: '',
    initialized: false  // 是否已初始化
  },

  onLoad() {
    this.setData({ isLeader: app.isLeader() });
    this.loadMembers();
  },

  onShow() {
    // 如果已初始化，刷新数据
    if (this.data.initialized) {
      this.loadMembers();
    }
  },

  // 加载成员列表
  async loadMembers() {
    try {
      const res = await api.getMemberList();
      const userInfo = wx.getStorageSync('userInfo');
      const department = wx.getStorageSync('department');
      const members = (res.data || []).map(m => ({
        ...m,
        isCreator: m.id === department?.creatorId
      }));
      
      this.setData({ 
        members,
        filteredMembers: this.filterMembers(members, this.data.keyword),
        initialized: true
      });
    } catch (error) {
      // 加载成员失败
    }
  },

  // 搜索
  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ 
      keyword,
      filteredMembers: this.filterMembers(this.data.members, keyword)
    });
  },

  // 过滤成员
  filterMembers(members, keyword) {
    if (!keyword) return members;
    return members.filter(m => 
      m.nickName.toLowerCase().includes(keyword.toLowerCase())
    );
  },

  // 踢出成员
  async kickMember(e) {
    const { id, name } = e.currentTarget.dataset;
    
    const confirm = await util.showConfirm('确认移出', `确定要将 ${name} 移出科室吗？`);
    if (!confirm) return;

    try {
      util.showLoading('处理中...');
      await api.kickMember(null, { memberId: id });
      util.hideLoading();
      util.showSuccess('已移出');
      this.loadMembers();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  }
});
