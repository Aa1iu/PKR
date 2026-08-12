import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChatMessage, Conversation } from '../types';

interface ChatState {
  /** 所有会话 */
  conversations: Conversation[];
  /** 当前活跃会话 ID */
  currentConversationId: string | null;
  /** 当前对话消息列表（派生自 activeConversation，为兼容旧接口保留） */
  messages: ChatMessage[];
  /** 输入框内容 */
  inputValue: string;
  /** 是否正在发送 */
  sending: boolean;

  // ---- 基础消息操作（兼容旧接口） ----
  addMessage: (msg: ChatMessage) => void;
  appendToken: (messageId: string, token: string) => void;
  finishMessage: (messageId: string, sources?: ChatMessage['sources'], follow_up_questions?: string[]) => void;
  setInputValue: (v: string) => void;
  setSending: (v: boolean) => void;
  clearMessages: () => void;

  // ---- 会话管理 ----
  /** 创建新会话并设为活跃 */
  createConversation: () => void;
  /** 切换到指定会话 */
  switchConversation: (id: string) => void;
  /** 删除会话 */
  deleteConversation: (id: string) => void;
  /** 确保存在活跃会话（无则创建），用于首次发消息时 */
  ensureConversation: () => void;
  /** 更新当前会话标题（仅当标题为 "新对话" 时生效） */
  autoTitleConversation: (title: string) => void;
  /** 保存当前 messages 到 conversations 快照 */
  saveCurrentMessages: () => void;
}

/**
 * 全局对话状态 — 多会话管理 + ChatPanel / FloatChat 共享
 *
 * 使用 zustand persist 持久化到 localStorage：
 * 刷新页面后会话列表和消息不丢失。
 */
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  inputValue: '',
  sending: false,

  // ===================== 基础消息操作 =====================

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendToken: (messageId, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + token } : m,
      ),
    })),

  finishMessage: (messageId, sources, follow_up_questions) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, sources, follow_up_questions } : m,
      ),
    })),

  setInputValue: (v) => set({ inputValue: v }),

  setSending: (v) => set({ sending: v }),

  clearMessages: () => set({ messages: [], inputValue: '', sending: false }),

  // ===================== 会话管理 =====================

  /** 保存当前 messages 到 conversations 中对应会话的快照 */
  saveCurrentMessages: () => {
    const { currentConversationId, messages, conversations } = get();
    if (!currentConversationId) return;
    set({
      conversations: conversations.map((c) =>
        c.id === currentConversationId
          ? { ...c, messages: [...messages], updated_at: new Date().toISOString() }
          : c,
      ),
    });
  },

  /** 确保存在活跃会话，无则创建 */
  ensureConversation: () => {
    const { currentConversationId, conversations } = get();
    if (currentConversationId) return; // 已有会话，无需创建

    const id = `conv_${Date.now()}`;
    const newConv: Conversation = {
      id,
      title: '新对话',
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set({
      conversations: [newConv, ...conversations],
      currentConversationId: id,
      messages: [],
      inputValue: '',
      sending: false,
    });
  },

  /** 创建新会话 */
  createConversation: () => {
    // 先保存当前会话
    get().saveCurrentMessages();

    const id = `conv_${Date.now()}`;
    const newConv: Conversation = {
      id,
      title: '新对话',
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({
      conversations: [newConv, ...s.conversations],
      currentConversationId: id,
      messages: [],
      inputValue: '',
      sending: false,
    }));
  },

  /** 切换到指定会话（保存当前 → 加载目标） */
  switchConversation: (id) => {
    const { conversations, currentConversationId } = get();
    if (id === currentConversationId) return;

    // 保存当前会话
    get().saveCurrentMessages();

    const target = conversations.find((c) => c.id === id);
    if (!target) return;

    set({
      currentConversationId: id,
      messages: [...target.messages],
      inputValue: '',
      sending: false,
    });
  },

  /** 删除会话 */
  deleteConversation: (id) => {
    const { currentConversationId, conversations } = get();
    const filtered = conversations.filter((c) => c.id !== id);

    if (currentConversationId === id) {
      // 删的是当前活跃会话 → 清空消息，切到 null
      set({
        conversations: filtered,
        currentConversationId: null,
        messages: [],
        inputValue: '',
        sending: false,
      });
    } else {
      set({ conversations: filtered });
    }
  },

  /** 自动命名当前会话（仅当标题仍为 "新对话"） */
  autoTitleConversation: (title) => {
    const { currentConversationId, conversations } = get();
    if (!currentConversationId) return;

    set({
      conversations: conversations.map((c) =>
        c.id === currentConversationId && c.title === '新对话'
          ? { ...c, title }
          : c,
      ),
    });
  },
    }),
    {
      name: 'pkr-chat-store',
      storage: createJSONStorage(() => localStorage),
      // 只持久化会话数据（inputValue/sending 等瞬时状态不持久化）
      partialize: (s) => ({
        conversations: s.conversations,
        currentConversationId: s.currentConversationId,
        messages: s.messages,
      }),
    },
  ),
);
