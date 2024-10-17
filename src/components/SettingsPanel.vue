<script setup>
import { ref } from 'vue';
import { defineProps, defineEmits } from 'vue';

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/stl';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';

const props = defineProps({
  settings: Object,
//actionStack: Array,
});

// const actionStack = props.actionStack;
// Keeping the window open for the possibility of needing to have an actionStack pushed on a value here

const emit = defineEmits([
  'update-background-color',
  'update-light-intensity',
  'update-light-direction',
  'update-light-color',
  'update-camera-speed',
  'undo-last-action',
  'update-paint-color',
  'toggle-visibility',
  'export-model'
]);

const showLightSettings = ref(false);
const paintColor = ref('#ff0000');

let showUncollapseButton = ref(false);
let isSettingsPanelVisible = ref(true);

const updateBackgroundColor = (event) => {
  emit('update-background-color', event);
};

const updateLightIntensity = (event) => {
  emit('update-light-intensity', event);
};

const updateLightDirection = (axis, value) => {
  emit('update-light-direction', axis, value);
};

const updateLightColor = (event) => {
  emit('update-light-color', event);
};

const updateCameraSpeed = (event) => {
  emit('update-camera-speed', event);
};

const undoLastAction = () => {
  emit('undo-last-action');
};

const updatePaintColor = (event) => {
  paintColor.value = event.target.value;
  emit('update-paint-color', paintColor.value);
};
</script>

<template>
  <transition name="settings-panel" @after-leave="showUncollapseButton=true">
    <div v-if="isSettingsPanelVisible" class="settings-panel">
      <div class="setting minimize-setting">
        <button class="minimize-button" @click="isSettingsPanelVisible=false">
          <img src="@/assets/collapse-right.svg" alt="Collapse Right" class="collapse-right" />
        </button>
      </div>
      <div class="setting">
        <label for="backgroundColor">Background Color</label>
        <input type="color" id="backgroundColor" v-model="settings.backgroundColor" @input="updateBackgroundColor" />
        <div class="setting-value">{{ settings.backgroundColor }}</div>
      </div>
      <div class="setting">
        <label for="lightIntensity">Light Intensity</label>
        <input class="slider" type="range" id="lightIntensity" min="0" max="2" step="0.1" v-model="settings.lightIntensity" @input="updateLightIntensity" />
        <div class="setting-value">{{ settings.lightIntensity }}</div>
        <button class="toggle-button" @click="showLightSettings = !showLightSettings">Advanced Light Settings</button>
      </div>
      <div v-if="showLightSettings" class="sub-settings">
        <div class="setting">
          <label for="lightDirectionX">Light Direction X</label>
          <input class="slider" type="range" id="lightDirectionX" min="-1" max="1" step="0.1" v-model="settings.lightDirectionX" @input="updateLightDirection('X', $event.target.value)" />
          <div class="setting-value">{{ settings.lightDirectionX }}</div>
        </div>
        <div class="setting">
          <label for="lightDirectionY">Light Direction Y</label>
          <input class="slider" type="range" id="lightDirectionY" min="-1" max="1" step="0.1" v-model="settings.lightDirectionY" @input="updateLightDirection('Y', $event.target.value)" />
          <div class="setting-value">{{ settings.lightDirectionY }}</div>
        </div>
        <div class="setting">
          <label for="lightDirectionZ">Light Direction Z</label>
          <input class="slider" type="range" id="lightDirectionZ" min="-1" max="1" step="0.1" v-model="settings.lightDirectionZ" @input="updateLightDirection('Z', $event.target.value)" />
          <div class="setting-value">{{ settings.lightDirectionZ }}</div>
        </div>
        <div class="setting">
          <label for="lightColor">Light Color</label>
          <input type="color" id="lightColor" v-model="settings.lightColor" @input="updateLightColor" />
          <div class="setting-value">{{ settings.lightColor }}</div>
        </div>
      </div>
      <div class="setting">
        <label for="cameraSpeed">Camera Speed</label>
        <input class="slider" type="range" id="cameraSpeed" min="0.1" max="10" step="0.1" v-model="settings.cameraSpeed" @input="updateCameraSpeed" />
        <div class="setting-value">{{ settings.cameraSpeed }}</div>
      </div>
      <div class="setting">
        <label for="cameraRadius">Camera Distance</label>
        <div class="setting-value">{{ settings.cameraRadius }}</div>
      </div>
      <div class="setting">
        <label for="paintColor">Paint Color</label>
        <input type="color" id="paintColor" v-model="paintColor" @input="updatePaintColor" />
        <div class="setting-value">{{ paintColor }}</div>
      </div>
      <div class="setting">
        <button class="base-button undo-button" @click="undoLastAction">Undo</button>
      </div>
      <div class="setting">
        <button class="base-button export-button" @click="$emit('export-model')">
          <img src="@/assets/download-icon.svg" alt="Download Icon" class="download-icon" />
          Export
        </button>
      </div>
    </div>
  </transition>
  <transition name="uncollapse-button">
    <template v-if="!isSettingsPanelVisible && showUncollapseButton">
      <button class="restore-button" @click="isSettingsPanelVisible=true; showUncollapseButton = false">
        <img src="@/assets/uncollapse-right.svg" alt="Uncollapse Right" class="uncollapse-right" />
      </button>
    </template>
  </transition>
</template>