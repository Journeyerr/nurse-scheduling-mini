// pages/member-info/member-info.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    memberId: '',
    memberInfo: {},
    originalInfo: {},
    isSelf: false,
    hasChanges: false
  },

  onLoad(options) {
    const { memberId } = options;
    const userInfo = wx.getStorageSync('userInfo');
    
    this.setData({
      memberId,
      isSelf: memberId === userInfo?.id
    });
    
    this.loadMemberInfo(memberId);
  },

  // 加载成员信息
  async loadMemberInfo(memberId) {
    try {
      wx.showLoading({ title: '加载中...' });
      const res = await api.getMemberInfo(memberId);
      wx.hideLoading();
      
      const department = wx.getStorageSync('department');
      const memberInfo = {
        ...res.data,
        department: department?.name || '',
        isCreator: res.data.id === department?.creatorId
      };
      
      this.setData({
        memberInfo,
        originalInfo: { ...memberInfo }
      });
    } catch (error) {
      wx.hideLoading();
      util.showError('加载失败');
    }
  },

  // 输入框变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    this.setData({
      [`memberInfo.${field}`]: value
    });
    
    // 检查是否有修改
    this.checkChanges();
  },

  // 检查是否有修改
  checkChanges() {
    const { memberInfo, originalInfo } = this.data;
    const fields = ['nickName', 'phone', 'workNo', 'title', 'seniority', 'remark'];
    
    const hasChanges = fields.some(field => {
      return memberInfo[field] !== originalInfo[field];
    });
    
    this.setData({ hasChanges });
  },

  // 保存信息
  async saveInfo() {
    if (!this.data.hasChanges) return;
    
    const { memberInfo } = this.data;
    
    // 验证必填项
    if (!memberInfo.nickName) {
      util.showError('请输入姓名');
      return;
    }
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      const updateData = {
        nickName: memberInfo.nickName,
        phone: memberInfo.phone,
        workNo: memberInfo.workNo,
        title: memberInfo.title,
        seniority: memberInfo.seniority ? parseInt(memberInfo.seniority) : null,
        remark: memberInfo.remark
      };
      
      await api.updateMemberInfo(this.data.memberId, updateData);
      
      // 更新本地存储
      if (this.data.isSelf) {
        const userInfo = wx.getStorageSync('userInfo');
        wx.setStorageSync('userInfo', { ...userInfo, ...updateData });
      }
      
      wx.hideLoading();
      util.showSuccess('保存成功');
      
      // 更新原始数据
      this.setData({
        originalInfo: { ...this.data.memberInfo },
        hasChanges: false
      });
      
    } catch (error) {
      wx.hideLoading();
      util.showError(error.message || '保存失败');
    }
  }
});
