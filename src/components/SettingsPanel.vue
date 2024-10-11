<script setup>
const settings = defineProps(['settings', 'updateLightIntensity', 'updateCameraSpeed', 'updateBackgroundColor']);
</script>

<template>
  <div class="settings-panel">
    <div class="setting">
      <label for="lightIntensity">Light Intensity</label>
      <input type="range" id="lightIntensity" min="0" max="2" step="0.1" v-model="settings.lightIntensity" @input="updateLightIntensity" />
    </div>
    <!-- Add other settings here -->
  </div>
</template>

<style scoped>
.settings-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 10px;
}
</style>
