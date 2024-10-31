import { observable } from 'mobx'
import type { RequestOption } from 'miniprogram-api-typings'

// 请求配置接口
interface RequestConfig extends RequestOption {
  loading?: boolean; // 是否显示加载提示
  auth?: boolean;    // 是否需要认证
  retry?: number;    // 重试次数
}

// 响应数据接口
interface ResponseData<T = any> {
  code: number;
  data: T;
  message: string;
}

// 存储token的Store
const authStore = observable({
  token: '',
  setToken(token: string) {
    this.token = token;
    wx.setStorageSync('token', token);
  },
  getToken() {
    if (!this.token) {
      this.token = wx.getStorageSync('token');
    }
    return this.token;
  },
  clearToken() {
    this.token = '';
    wx.removeStorageSync('token');
  }
});

// 基础配置
const BASE_URL = 'https://your-api-domain.com';
const TIMEOUT = 10000;
const MAX_RETRY_COUNT = 3;

class Request {
  private static instance: Request;
  private isRefreshing: boolean = false;
  private retryQueue: Array<() => Promise<any>> = [];

  private constructor() {}

  // 单例模式获取实例
  public static getInstance(): Request {
    if (!Request.instance) {
      Request.instance = new Request();
    }
    return Request.instance;
  }

  // 微信登录
  private async login(): Promise<string> {
    try {
      const { code } = await wx.login();
      const res = await this.request<{ token: string }>({
        url: '/auth/login',
        method: 'POST',
        data: { code },
        auth: false
      });
      authStore.setToken(res.data.token);
      return res.data.token;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  // 刷新token
  private async refreshToken(): Promise<string> {
    try {
      const res = await this.request<{ token: string }>({
        url: '/auth/refresh',
        method: 'POST',
        auth: false,
        data: {
          oldToken: authStore.getToken()
        }
      });
      authStore.setToken(res.data.token);
      return res.data.token;
    } catch (error) {
      authStore.clearToken();
      throw error;
    }
  }

  // 主请求方法
  public async request<T>(config: RequestConfig): Promise<ResponseData<T>> {
    const finalConfig = this.mergeConfig(config);

    // 是否显示加载提示
    if (finalConfig.loading) {
      wx.showLoading({ title: '加载中...' });
    }

    try {
      const response = await this.handleRequest<T>(finalConfig);
      return response;
    } catch (error) {
      throw error;
    } finally {
      if (finalConfig.loading) {
        wx.hideLoading();
      }
    }
  }

  // 处理请求
  private async handleRequest<T>(config: RequestConfig, retryCount = 0): Promise<ResponseData<T>> {
    try {
      // 处理认证
      if (config.auth && !authStore.getToken()) {
        await this.login();
      }

      const response = await this.wxRequest<T>(config);

      // 处理响应
      if (response.code === 200) {
        return response;
      }

      // token过期处理
      if (response.code === 401) {
        return this.handleTokenExpired(config);
      }

      throw new Error(response.message || '请求失败');
    } catch (error) {
      // 超时或网络错误重试
      if (retryCount < (config.retry || MAX_RETRY_COUNT)) {
        return this.handleRequest(config, retryCount + 1);
      }
      throw error;
    }
  }

  // 处理token过期
  private async handleTokenExpired<T>(config: RequestConfig): Promise<ResponseData<T>> {
    if (this.isRefreshing) {
      // 将请求加入队列
      return new Promise((resolve) => {
        this.retryQueue.push(() => {
          resolve(this.request(config));
        });
      });
    }

    this.isRefreshing = true;

    try {
      await this.refreshToken();
      this.isRefreshing = false;
      // 重试队列中的请求
      this.retryQueue.forEach((retry) => retry());
      this.retryQueue = [];
      // 重试当前请求
      return this.request(config);
    } catch (error) {
      this.isRefreshing = false;
      this.retryQueue = [];
      throw error;
    }
  }

  // 微信请求Promise化
  private wxRequest<T>(config: RequestConfig): Promise<ResponseData<T>> {
    return new Promise((resolve, reject) => {
      wx.request({
        ...config,
        url: BASE_URL + config.url,
        timeout: TIMEOUT,
        header: {
          ...config.header,
          'Authorization': config.auth ? `Bearer ${authStore.getToken()}` : '',
          'Content-Type': 'application/json'
        },
        success: (res: any) => {
          resolve(res.data);
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  }

  // 合并配置
  private mergeConfig(config: RequestConfig): RequestConfig {
    return {
      loading: false,
      auth: true,
      retry: MAX_RETRY_COUNT,
      ...config
    };
  }
}

// 导出请求实例
export const request = Request.getInstance();

// 使用示例
export const api = {
  // GET请求示例
  async getUser() {
    return request.request<{
      id: string;
      name: string;
    }>({
      url: '/user/info',
      method: 'GET',
      loading: true
    });
  },

  // POST请求示例
  async updateUser(data: any) {
    return request.request({
      url: '/user/update',
      method: 'POST',
      data,
      loading: true
    });
  }
}; 