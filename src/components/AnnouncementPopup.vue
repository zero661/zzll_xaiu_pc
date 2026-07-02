<template>
    <div>
        <!-- 公告列表区域（滚动） -->
        <div class="announcement-section" v-if="announcementList.length > 0">
            <div class="announcement-header">
                <div class="title">
                    <van-icon name="bullhorn-o" />
                    <span>最新公告</span>
                </div>
                <span class="more" @click="openAnnouncementList">查看更多</span>
            </div>
            <!-- 优化：公告列表容器支持内部滚动，限制最大高度 -->
            <div class="announcement-list-wrapper" :class="{ 'has-scroll': displayList.length > 3 }" @touchstart.stop
                @touchmove.stop @scroll.stop>
                <div class="announcement-list">
                    <div v-for="item in displayList" :key="item.id" class="announcement-item" @click="showDetail(item)">
                        <div class="item-badge" :class="getBadgeClass(item.type)">
                            {{ getBadgeText(item.type) }}
                        </div>
                        <div class="item-title">{{ item.title }}</div>
                        <div class="item-time">{{ formatDate(item.published_at) }}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 公告列表弹窗（查看更多） -->
        <van-popup v-model:show="showListPopup" position="bottom" :style="{ height: '80%' }" round closeable
            @touchstart.stop @touchmove.stop>
            <div class="popup-header">
                <h3>系统公告</h3>
            </div>
            <!-- 弹窗内的列表，阻止滚动冒泡 -->
            <div class="popup-list" @touchstart.stop @touchmove.stop @scroll.stop>
                <div v-for="item in announcementList" :key="item.id" class="popup-item" @click="showDetail(item)">
                    <div class="popup-item-header">
                        <div class="popup-item-badge" :class="getBadgeClass(item.type)">
                            {{ getBadgeText(item.type) }}
                        </div>
                        <div class="popup-item-title">{{ item.title }}</div>
                    </div>
                    <div class="popup-item-time">{{ formatFullDate(item.published_at) }}</div>
                </div>
                <div v-if="announcementList.length === 0" class="empty-tip">
                    <van-icon name="info-o" size="40" color="#cbd5e1" />
                    <p>暂无公告</p>
                </div>
            </div>
        </van-popup>

        <!-- 公告详情弹窗 -->
        <van-dialog v-model:show="showDetailDialog" :title="currentAnnouncement?.title" confirm-button-text="我知道了"
            class="announcement-detail-dialog" @touchstart.stop @touchmove.stop>
            <div class="detail-content" v-html="currentAnnouncement?.content" @touchstart.stop @touchmove.stop></div>
            <div class="detail-footer" v-if="currentAnnouncement?.published_at">
                发布于 {{ formatFullDate(currentAnnouncement.published_at) }}
            </div>
        </van-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, defineExpose } from 'vue';
import request from '@/utils/request';

const announcementList = ref([]);
const showListPopup = ref(false);
const showDetailDialog = ref(false);
const currentAnnouncement = ref(null);

// 显示的公告列表（最多3条）
const displayList = computed(() => {
    return announcementList.value.slice(0, 3);
});

// 根据类型获取标签文字
const getBadgeText = (type) => {
    const badgeMap = {
        'urgent': '紧急',
        'important': '重要',
        'normal': '普通',
        'info': '通知'
    };
    return badgeMap[type] || '公告';
};

// 根据类型获取标签样式
const getBadgeClass = (type) => {
    const classMap = {
        'urgent': 'badge-urgent',
        'important': 'badge-important',
        'normal': 'badge-normal',
        'info': 'badge-info'
    };
    return classMap[type] || 'badge-normal';
};

// 格式化时间（简短显示）
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // 今天发布的显示时间
    if (diff < 24 * 60 * 60 * 1000) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    // 超过一天显示月/日
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

// 格式化完整时间
const formatFullDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 检查公告是否在有效期内
const isAnnouncementValid = (item) => {
    const now = new Date();

    // 检查开始时间
    if (item.start_time && new Date(item.start_time) > now) {
        return false;
    }
    // 检查结束时间
    if (item.end_time && new Date(item.end_time) < now) {
        return false;
    }
    return true;
};

// 获取公告列表
const fetchAnnouncements = async () => {
    try {
        const response = await request.get('/mb-announcements/active');
        console.log('[公告] 获取公告列表:', response);

        if (response.success && response.data) {
            // 过滤有效公告并按 sort_order 排序
            let list = response.data.filter(item => isAnnouncementValid(item));
            list = list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            announcementList.value = list;
        } else if (Array.isArray(response)) {
            // 如果直接返回数组
            let list = response.filter(item => isAnnouncementValid(item));
            list = list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            announcementList.value = list;
        }
    } catch (error) {
        console.error('获取公告失败:', error);
        // 静默失败，不影响主要功能
    }
};

// 打开公告列表弹窗
const openAnnouncementList = () => {
    showListPopup.value = true;
};

// 显示公告详情
const showDetail = (item) => {
    currentAnnouncement.value = item;
    showDetailDialog.value = true;
};

// 刷新公告（供父组件调用）
const refresh = () => {
    fetchAnnouncements();
};

// 暴露方法给父组件调用
defineExpose({
    refresh
});

onMounted(() => {
    fetchAnnouncements();
});
</script>

<style scoped lang="scss">
// 公告列表区域 — 玻璃面板 + 高光（仅此部分改为玻璃效果）
.announcement-section {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  margin: 12px;
  padding: 12px 16px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;

  // 顶部高光线
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent);
    border-radius: 28px 28px 0 0;
    pointer-events: none;
    z-index: 1;
  }
}

.announcement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  z-index: 2;

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2d3d;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);

    .van-icon {
      font-size: 16px;
      color: #1e293b;
    }
  }

  .more {
    font-size: 12px;
    color: #475569;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s;

    &:active {
      transform: scale(0.96);
      background: rgba(255, 255, 255, 0.6);
    }
  }
}

/* 公告列表滚动容器（保持原样式，只微调背景透明） */
.announcement-list-wrapper {
  max-height: 200px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -4px;
  padding: 0 4px;
  position: relative;
  z-index: 2;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 4px;
  }
  &:not(.has-scroll) {
    overflow-y: visible;
    &::-webkit-scrollbar {
      display: none;
    }
  }
}

.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.announcement-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  cursor: pointer;

  &:active {
    opacity: 0.7;
  }

  .item-badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 500;

    &.badge-urgent {
      background: #fee2e2;
      color: #e54545;
    }
    &.badge-important {
      background: #ffedd5;
      color: #c2410c;
    }
    &.badge-normal {
      background: #f1f5f9;
      color: #475569;
    }
    &.badge-info {
      background: #dbeafe;
      color: #1d4ed8;
    }
  }

  .item-title {
    flex: 1;
    font-size: 13px;
    color: #334155;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-time {
    flex-shrink: 0;
    font-size: 11px;
    color: #94a3b8;
  }
}

// 弹窗样式（完全恢复原状）
.popup-header {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid #eef2f6;

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #1f2d3d;
  }
}

.popup-list {
  padding: 12px;
  height: calc(100% - 60px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.popup-item {
  padding: 14px 12px;
  border-bottom: 1px solid #f0f2f5;
  cursor: pointer;

  &:active {
    background-color: #f8fafc;
  }

  .popup-item-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;

    .popup-item-badge {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 500;

      &.badge-urgent {
        background: #fee2e2;
        color: #e54545;
      }
      &.badge-important {
        background: #ffedd5;
        color: #c2410c;
      }
      &.badge-normal {
        background: #f1f5f9;
        color: #475569;
      }
      &.badge-info {
        background: #dbeafe;
        color: #1d4ed8;
      }
    }

    .popup-item-title {
      flex: 1;
      font-size: 15px;
      font-weight: 500;
      color: #1f2d3d;
    }
  }

  .popup-item-time {
    font-size: 11px;
    color: #94a3b8;
    margin-left: 50px;
  }
}

.empty-tip {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
  font-size: 14px;

  p {
    margin-top: 12px;
  }
}

// 详情弹窗样式（原样）
.announcement-detail-dialog {
  :deep(.van-dialog__content) {
    padding: 0;
  }

  :deep(.van-dialog__header) {
    font-size: 16px;
    font-weight: 600;
    padding: 16px 20px 8px;
  }
}

.detail-content {
  max-height: 50vh;
  overflow-y: auto;
  padding: 0 20px;
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
  text-align: left;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
  }

  h1, h2, h3 {
    margin: 12px 0 8px;
  }
  p {
    margin: 8px 0;
  }
  ul, ol {
    padding-left: 20px;
    margin: 8px 0;
  }
  li {
    margin: 4px 0;
  }
}

.detail-footer {
  padding: 12px 20px 20px;
  font-size: 11px;
  color: #94a3b8;
  text-align: right;
  border-top: 1px solid #f0f2f5;
  margin-top: 8px;
}
</style>