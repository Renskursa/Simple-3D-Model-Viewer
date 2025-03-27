<template>
  <div class="settings-panel" :class="{ collapsed: isCollapsed }">
    <div class="panel-header" @click="toggleCollapsed">
      <h2>Settings</h2>
      <button class="collapse-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M9,5L16,12L9,19V5Z" />
        </svg>
      </button>
    </div>
    
    <div class="panel-content">
      <div class="setting-section">
        <h3>Scene Settings</h3>
        
        <div class="setting">
          <label for="backgroundColor">Background Color</label>
          <div class="color-input-container">
            <input type="color" id="backgroundColor" v-model="settings.backgroundColor" @input="updateBackgroundColor" />
            <div class="setting-value">{{ settings.backgroundColor }}</div>
          </div>
        </div>
      </div>
  
      <div class="setting-section">
        <h3>Light Settings</h3>
        
        <div class="setting">
          <label for="lightIntensity">Light Intensity</label>
          <input class="slider" type="range" id="lightIntensity" min="0" max="1" step="0.1" 
                 v-model="settings.lightIntensity" @input="updateLightIntensity" />
          <div class="setting-value">{{ settings.lightIntensity }}</div>
        </div>
  
        <div class="setting">
          <label for="lightColor">Light Color</label>
          <div class="color-input-container">
            <input type="color" id="lightColor" v-model="settings.lightColor" @input="updateLightColor" />
            <div class="setting-value">{{ settings.lightColor }}</div>
          </div>
        </div>
  
        <button class="toggle-button" @click="showLightDirectionSettings = !showLightDirectionSettings">
          <span>Light Direction</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" 
               :style="{ transform: showLightDirectionSettings ? 'rotate(180deg)' : 'rotate(0deg)' }">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
          </svg>
        </button>
  
        <div v-if="showLightDirectionSettings" class="sub-settings">
          <div class="setting">
            <label for="lightDirectionX">Direction X</label>
            <input class="slider" type="range" id="lightDirectionX" min="-1" max="1" step="0.1" 
                   v-model="settings.lightDirectionX" @input="updateLightDirectionX" />
            <div class="setting-value">{{ settings.lightDirectionX }}</div>
          </div>
          <div class="setting">
            <label for="lightDirectionY">Direction Y</label>
            <input class="slider" type="range" id="lightDirectionY" min="-1" max="1" step="0.1" 
                   v-model="settings.lightDirectionY" @input="updateLightDirectionY" />
            <div class="setting-value">{{ settings.lightDirectionY }}</div>
          </div>
          <div class="setting">
            <label for="lightDirectionZ">Direction Z</label>
            <input class="slider" type="range" id="lightDirectionZ" min="-1" max="1" step="0.1" 
                   v-model="settings.lightDirectionZ" @input="updateLightDirectionZ" />
            <div class="setting-value">{{ settings.lightDirectionZ }}</div>
          </div>
        </div>
      </div>
  
      <div class="setting-section">
        <h3>Camera Settings</h3>
        
        <div class="setting">
          <label for="cameraSpeed">Camera Speed</label>
          <input class="slider" type="range" id="cameraSpeed" min="0.1" max="2" step="0.1" 
                 v-model="settings.cameraSpeed" @input="updateCameraSpeed" />
          <div class="setting-value">{{ settings.cameraSpeed }}</div>
        </div>
      </div>
  
      <div v-if="enableTransforms" class="setting-section">
        <h3>Transform Settings</h3>
  
        <button class="toggle-button" @click="showPositionSettings = !showPositionSettings">
          <span>Position</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" 
               :style="{ transform: showPositionSettings ? 'rotate(180deg)' : 'rotate(0deg)' }">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
          </svg>
        </button>
  
        <div v-if="showPositionSettings" class="sub-settings">
          <div class="setting">
            <label for="positionX">Position X</label>
            <input class="number-input" type="number" id="positionX" step="0.1" 
                  v-model="settings.positionX" @input="updatePositionX" />
          </div>
          <div class="setting">
            <label for="positionY">Position Y</label>
            <input class="number-input" type="number" id="positionY" step="0.1" 
                  v-model="settings.positionY" @input="updatePositionY" />
          </div>
          <div class="setting">
            <label for="positionZ">Position Z</label>
            <input class="number-input" type="number" id="positionZ" step="0.1" 
                  v-model="settings.positionZ" @input="updatePositionZ" />
          </div>
        </div>
  
        <button class="toggle-button" @click="showRotationSettings = !showRotationSettings">
          <span>Rotation</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" 
               :style="{ transform: showRotationSettings ? 'rotate(180deg)' : 'rotate(0deg)' }">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
          </svg>
        </button>
  
        <div v-if="showRotationSettings" class="sub-settings">
          <div class="setting">
            <label for="rotationX">Rotation X</label>
            <input class="number-input" type="number" id="rotationX" step="0.1" 
                  v-model="settings.rotationX" @input="updateRotationX" />
          </div>
          <div class="setting">
            <label for="rotationY">Rotation Y</label>
            <input class="number-input" type="number" id="rotationY" step="0.1" 
                  v-model="settings.rotationY" @input="updateRotationY" />
          </div>
          <div class="setting">
            <label for="rotationZ">Rotation Z</label>
            <input class="number-input" type="number" id="rotationZ" step="0.1" 
                  v-model="settings.rotationZ" @input="updateRotationZ" />
          </div>
        </div>
  
        <button class="toggle-button" @click="showScalingSettings = !showScalingSettings">
          <span>Scaling</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" 
               :style="{ transform: showScalingSettings ? 'rotate(180deg)' : 'rotate(0deg)' }">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
          </svg>
        </button>
  
        <div v-if="showScalingSettings" class="sub-settings">
          <div class="setting">
            <label for="scalingX">Scaling X</label>
            <input class="number-input" type="number" id="scalingX" min="0.1" step="0.1" 
                  v-model="settings.scalingX" @input="updateScalingX" />
          </div>
          <div class="setting">
            <label for="scalingY">Scaling Y</label>
            <input class="number-input" type="number" id="scalingY" min="0.1" step="0.1" 
                  v-model="settings.scalingY" @input="updateScalingY" />
          </div>
          <div class="setting">
            <label for="scalingZ">Scaling Z</label>
            <input class="number-input" type="number" id="scalingZ" min="0.1" step="0.1" 
                  v-model="settings.scalingZ" @input="updateScalingZ" />
          </div>
        </div>
      </div>
  
      <div class="setting-section">
        <h3>Actions</h3>
        
        <div class="button-row">
          <button class="action-button" @click="undoLastAction">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z" />
            </svg>
            Undo
          </button>
          <button class="action-button" @click="exportModel">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
            </svg>
            Export
          </button>
        </div>
      </div>
    </div>

    <!-- Expand button that's only visible when collapsed -->
    <button class="expand-button" v-if="isCollapsed" @click="toggleCollapsed">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M15,19L8,12L15,5V19Z" />
      </svg>
    </button>
  </div>
</template>

<script>
export default {
  props: {
    settings: {
      type: Object,
      required: true
    },
    enableTransforms: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'update-background-color', 
    'update-light-intensity', 
    'update-light-direction', 
    'update-light-color', 
    'update-camera-speed', 
    'undo-last-action',
    'update-transform',
    'export-model'
  ],
  data() {
    return {
      isCollapsed: false,
      showLightDirectionSettings: false,
      showPositionSettings: false,
      showRotationSettings: false,
      showScalingSettings: false,
    };
  },
  methods: {
    toggleCollapsed() {
      this.isCollapsed = !this.isCollapsed;
    },
    updateBackgroundColor(event) {
      this.$emit('update-background-color', event);
    },
    updateLightIntensity(event) {
      this.$emit('update-light-intensity', event);
    },
    updateLightDirectionX(event) {
      this.$emit('update-light-direction', 'X', event.target.value);
    },
    updateLightDirectionY(event) {
      this.$emit('update-light-direction', 'Y', event.target.value);
    },
    updateLightDirectionZ(event) {
      this.$emit('update-light-direction', 'Z', event.target.value);
    },
    updateLightColor(event) {
      this.$emit('update-light-color', event);
    },
    updateCameraSpeed(event) {
      this.$emit('update-camera-speed', event);
    },
    undoLastAction() {
      this.$emit('undo-last-action');
    },
    updatePositionX(event) {
      this.$emit('update-transform', 'position', 'X', event.target.value);
    },
    updatePositionY(event) {
      this.$emit('update-transform', 'position', 'Y', event.target.value);
    },
    updatePositionZ(event) {
      this.$emit('update-transform', 'position', 'Z', event.target.value);
    },
    updateRotationX(event) {
      this.$emit('update-transform', 'rotation', 'X', event.target.value);
    },
    updateRotationY(event) {
      this.$emit('update-transform', 'rotation', 'Y', event.target.value);
    },
    updateRotationZ(event) {
      this.$emit('update-transform', 'rotation', 'Z', event.target.value);
    },
    updateScalingX(event) {
      this.$emit('update-transform', 'scaling', 'X', event.target.value);
    },
    updateScalingY(event) {
      this.$emit('update-transform', 'scaling', 'Y', event.target.value);
    },
    updateScalingZ(event) {
      this.$emit('update-transform', 'scaling', 'Z', event.target.value);
    },
    exportModel() {
      this.$emit('export-model');
    }
  }
};
</script>

<style scoped>
.settings-panel {
  position: fixed;
  top: 100px;
  right: 0;
  width: 280px;
  background-color: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  color: white;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease;
  overflow: visible;
  z-index: 999;
}

.settings-panel.collapsed {
  transform: translateX(280px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h2 {
  font-size: 18px;
  margin: 0;
}

.collapse-button {
  background: none;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.collapse-button:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.expand-button {
  position: absolute;
  left: -40px;
  top: 10px;
  background-color: rgba(26, 26, 46, 0.8);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  transition: background-color 0.2s, transform 0.2s;
}

.expand-button:hover {
  background-color: rgba(38, 38, 66, 0.95);
  transform: translateX(-4px);
}

.panel-content {
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 15px;
}

.setting-section {
  margin-bottom: 20px;
}

.setting-section h3 {
  font-size: 16px;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 5px;
}

.setting {
  margin-bottom: 10px;
}

.setting label {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
}

.color-input-container {
  display: flex;
  align-items: center;
}

input[type="color"] {
  width: 30px;
  height: 30px;
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
}

.setting-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 10px;
}

.toggle-button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 0;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sub-settings {
  padding-left: 10px;
  margin-bottom: 15px;
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: rgba(233, 69, 96, 0.9);
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: rgba(233, 69, 96, 0.9);
  cursor: pointer;
  border: none;
}

.number-input {
  width: 100%;
  padding: 6px;
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  border-radius: 4px;
}

.button-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.action-button {
  background-color: rgba(233, 69, 96, 0.7);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
  transition: background-color 0.2s;
}

.action-button:hover {
  background-color: rgba(233, 69, 96, 0.9);
}

/* Mobile styles */
@media (max-width: 768px) {
  .settings-panel {
    top: auto;
    bottom: 10px;
    right: 0;
    width: 280px;
    max-width: 100%;
  }

  .settings-panel.collapsed {
    transform: translateX(280px);
  }

  .expand-button {
    bottom: 10px;
    top: auto;
  }

  .panel-content {
    max-height: 60vh;
  }

  .setting-section {
    margin-bottom: 15px;
  }

  .setting {
    margin-bottom: 8px;
  }
}
</style>