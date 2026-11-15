<template>
  <div class="notification-panel" :class="{ visible: panelVisible }">
    <div class="panel-header">
      <span class="panel-title">{{ t('notification.title') }}</span>
      <button class="panel-close" @click="panelVisible = false">&times;</button>
    </div>
    <div v-if="showSystemNudge" class="panel-nudge">
      <span class="panel-nudge-text">{{ t('notification.systemNudge') }}</span>
      <div class="panel-nudge-actions">
        <button class="panel-nudge-enable" :disabled="nudgeBusy" @click="enableSystemNotifications">
          {{ t('notification.systemNudgeEnable') }}
        </button>
        <button
          class="panel-nudge-dismiss"
          :title="t('notification.systemNudgeDismiss')"
          @click="dismissNudge"
        >
          &times;
        </button>
      </div>
    </div>
    <div class="panel-list">
      <NotificationCard
        v-for="n in notifications"
        :key="n.id"
        :type="n.type"
        :title="n.title"
        :body="n.body"
        :timestamp="n.timestamp"
        :pane-label="n.paneId ? paneLabels[n.paneId] : undefined"
        :source="n.source"
        @dismiss="dismissOne(n.id)"
        @goto="n.paneId && ($emit('goto-pane', n.paneId), (panelVisible = false))"
      />
      <div v-if="notifications.length === 0" class="panel-empty">{{ t('notification.empty') }}</div>
    </div>
    <button class="panel-clear" @click="clearAll">
      {{ t('notification.clearAll') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useNotification } from '../../composables/useNotification'
import { useNotificationPresentation } from '../../composables/useNotificationPresentation'
import {
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
  type SystemNotificationPermission,
} from '../../composables/useSystemNotification'
import { isTauri } from '../../composables/useTransport'
import { useI18n } from '../../composables/useI18n'
import NotificationCard from './NotificationCard.vue'

defineProps<{
  paneLabels: Record<string, string>
}>()

defineEmits<{ 'goto-pane': [paneId: string] }>()

const { notifications, panelVisible, dismissOne, clearAll } = useNotification()
const { t } = useI18n()
const { settings: presentation } = useNotificationPresentation()

const SYSTEM_NUDGE_KEY = 'dinotty_notification_system_nudge_v1'
const systemPermission = ref<SystemNotificationPermission>(getSystemNotificationPermission())
const nudgeDismissed = ref(readNudgeDismissed())
const nudgeBusy = ref(false)

function readNudgeDismissed(): boolean {
  try {
    return localStorage.getItem(SYSTEM_NUDGE_KEY) === '1'
  } catch {
    return false
  }
}

const showSystemNudge = computed(
  () =>
    !isTauri() &&
    systemPermission.value === 'default' &&
    !presentation.channels.system &&
    !nudgeDismissed.value
)

watch(panelVisible, (visible) => {
  if (visible) systemPermission.value = getSystemNotificationPermission()
})

async function enableSystemNotifications() {
  if (nudgeBusy.value) return
  nudgeBusy.value = true
  try {
    const state = await requestSystemNotificationPermission()
    systemPermission.value = state
    presentation.channels.system = state === 'granted'
    if (state === 'granted') dismissNudge()
  } finally {
    nudgeBusy.value = false
  }
}

function dismissNudge() {
  nudgeDismissed.value = true
  try {
    localStorage.setItem(SYSTEM_NUDGE_KEY, '1')
  } catch {
    /* storage unavailable: the nudge returns on the next session */
  }
}
</script>

<style scoped>
.notification-panel {
  position: fixed;
  top: calc(40px + env(safe-area-inset-top, 0px));
  right: 8px;
  width: min(320px, calc(100vw - 16px));
  max-height: min(480px, calc(100vh - 60px));
  overflow: hidden;
  transform: translateY(-10px);
  opacity: 0;
  pointer-events: none;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-surface, #1e1e2e);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.notification-panel.visible {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--divider, #333);
  flex-shrink: 0;
}
.panel-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-muted, #888);
}
.panel-close {
  background: none;
  border: none;
  color: var(--fg-muted, #888);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.panel-close:hover {
  color: var(--fg);
}
.panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.panel-empty {
  text-align: center;
  color: var(--fg-muted);
  font-size: 12px;
  padding: 24px 0;
}
.panel-clear {
  margin: 8px 12px 12px;
  padding: 6px 0;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--fg-muted, #888);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.panel-clear:hover {
  color: var(--fg);
  border-color: var(--fg-muted);
}
.panel-nudge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider, #333);
  background: var(--bg-input, rgba(255, 255, 255, 0.04));
  flex-shrink: 0;
}
.panel-nudge-text {
  flex: 1;
  font-size: 11px;
  line-height: 1.4;
  color: var(--fg-muted, #888);
}
.panel-nudge-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.panel-nudge-enable {
  padding: 3px 8px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
}
.panel-nudge-enable:hover {
  background: var(--accent);
  color: var(--bg-surface, #1e1e2e);
}
.panel-nudge-enable:disabled {
  opacity: 0.5;
  cursor: default;
}
.panel-nudge-dismiss {
  background: none;
  border: none;
  color: var(--fg-muted, #888);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.panel-nudge-dismiss:hover {
  color: var(--fg);
}
</style>
