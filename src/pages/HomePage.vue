<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Plus, Smartphone } from 'lucide-vue-next';
import InstanceCard from '../components/InstanceCard.vue';
import InstanceModal from '../components/InstanceModal.vue';
import BaseModal from '../components/BaseModal.vue';
import type { Instance } from '../types';
import { apiClient } from '../api';
import packageJson from '../../package.json';

const instances = ref<Instance[]>([]);
const showCreateModal = ref(false);
const loading = ref(false);
const version = packageJson.version;
const showMobileAccessModal = ref(false);
const qrCodeDataUrl = ref('');
const accessUrl = ref('');
const resolvingAccess = ref(false);

const loadInstances = async () => {
  loading.value = true;
  try {
    instances.value = await apiClient.getInstances();
  } catch (error) {
    console.error('Failed to load instances:', error);
    alert('加载实例列表失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadInstances();
});

const handleCreate = () => {
  showCreateModal.value = true;
};

const resolveAccessUrl = async () => {
  const { protocol, hostname, port } = window.location;
  let targetHost = hostname;
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    try {
      const res = await fetch('/api/network-ip');
      if (res.ok) {
        const data = await res.json();
        if (data?.ip) targetHost = data.ip;
      }
    } catch (error) {
      console.error('Failed to resolve network IP:', error);
    }
  }
  const hostWithPort = port ? `${targetHost}:${port}` : targetHost;
  return `${protocol}//${hostWithPort}`;
};

const buildQrCodeUrl = (url: string) => {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`;
};

const handleOpenMobileAccess = async () => {
  showMobileAccessModal.value = true;
  resolvingAccess.value = true;
  qrCodeDataUrl.value = '';
  try {
    const url = await resolveAccessUrl();
    accessUrl.value = url;
    qrCodeDataUrl.value = buildQrCodeUrl(url);
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    const fallback = window.location.origin;
    accessUrl.value = fallback;
    qrCodeDataUrl.value = buildQrCodeUrl(fallback);
  } finally {
    resolvingAccess.value = false;
  }
};

const handleSaveInstance = async (data: any) => {
  try {
    await apiClient.createInstance({
      name: data.name,
      accessAddress: data.accessAddress,
      // @ts-ignore
      nodes: [],
      // @ts-ignore
      status: 'stopped'
    });
    showCreateModal.value = false;
    await loadInstances();
  } catch (error) {
    console.error('Failed to create instance:', error);
    alert('创建实例失败');
  }
};
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900">实例管理</h1>
          <span class="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium">v{{ version }}</span>
        </div>
        <p class="text-gray-500 mt-1 hidden sm:block">管理您所有的 MCP 服务实例与节点状态</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button 
          @click="handleOpenMobileAccess"
          class="hidden sm:flex items-center justify-center px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Smartphone class="w-5 h-5 mr-2" />
          手机访问
        </button>
        <button 
          @click="handleCreate"
          class="flex items-center justify-center px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus class="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
          <span class="sm:inline">新建实例</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <div v-else-if="instances.length === 0" class="text-center py-12 text-gray-500">
      暂无实例，请点击右上角新建
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <InstanceCard 
        v-for="inst in instances" 
        :key="inst.id" 
        :instance="inst" 
      />
    </div>

    <InstanceModal 
      :show="showCreateModal" 
      @close="showCreateModal = false"
      @save="handleSaveInstance"
    />

    <BaseModal
      :show="showMobileAccessModal"
      title="手机访问"
      maxWidth="sm:max-w-md"
      @close="showMobileAccessModal = false"
    >
      <div class="flex flex-col items-center gap-3">
        <div v-if="resolvingAccess" class="flex items-center justify-center py-6">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <img v-else-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="QR Code" class="w-48 h-48" />
        <div v-else class="text-sm text-gray-500">二维码生成失败</div>
        <div v-if="accessUrl" class="text-xs text-gray-500 break-all">{{ accessUrl }}</div>
        <div class="text-xs text-gray-500">本地使用请确保手机与实例管理在同一网络下</div>
      </div>
    </BaseModal>
  </div>
</template>
