<script setup>
import './style.css'
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, SceneLoader, StandardMaterial, Color3 } from '@babylonjs/core';
import '@babylonjs/loaders/stl';
import '@babylonjs/loaders/glTF';
import { ref, onMounted, onBeforeUnmount, reactive } from 'vue';

const canvasRef = ref(null);
const errorMessage = ref('');
const showErrorModal = ref(false);
const showLightSettings = ref(false);
const settings = reactive({
  lightIntensity: 0.7,
  cameraRadius: 10,
  backgroundColor: '#242424',
  lightDirectionX: 1,
  lightDirectionY: 1,
  lightDirectionZ: 0,
  cameraSpeed: 1,
});

let engine, scene, camera, light;
const MIN_CAMERA_RADIUS = 1.5;

const initBabylonJS = () => {
  engine = new Engine(canvasRef.value, true);
  scene = new Scene(engine);
  scene.clearColor = Color3.FromHexString(settings.backgroundColor);

  camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, settings.cameraRadius, Vector3.Zero(), scene);
  camera.attachControl(canvasRef.value, true);
  camera.wheelPrecision = 50 / settings.cameraSpeed;
  camera.angularSensibilityX = 1000 / settings.cameraSpeed;
  camera.angularSensibilityY = 1000 / settings.cameraSpeed;

  light = new HemisphericLight("light", new Vector3(settings.lightDirectionX, settings.lightDirectionY, settings.lightDirectionZ), scene);
  light.intensity = settings.lightIntensity;

  engine.runRenderLoop(() => {
    if (camera.radius < MIN_CAMERA_RADIUS) {
      camera.radius = MIN_CAMERA_RADIUS;
    }
    settings.cameraRadius = parseFloat(camera.radius.toFixed(2));
    scene.render();
  });

  window.addEventListener('resize', handleResize);
};

const handleResize = () => {
  engine.resize();
};

const loadModel = (file) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = event.target.result;
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const extension = file.name.split('.').pop().toLowerCase();
    SceneLoader.Append("", url, scene, (newScene) => {
      console.log(`${extension.toUpperCase()} model loaded:`, newScene);
    }, null, (scene, message, exception) => {
      console.error(message, exception);
      errorMessage.value = message;
      showErrorModal.value = true;
    }, `.${extension}`);
  };
  reader.readAsArrayBuffer(file);
};

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file && (file.name.endsWith('.stl') || file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
    loadModel(file);
  }
};

const updateLightIntensity = (event) => {
  settings.lightIntensity = event.target.value;
  light.intensity = settings.lightIntensity;
};

const updateBackgroundColor = (event) => {
  settings.backgroundColor = event.target.value;
  scene.clearColor = Color3.FromHexString(settings.backgroundColor);
};

const updateLightDirection = (axis, value) => {
  settings[`lightDirection${axis}`] = value;
  light.direction = new Vector3(settings.lightDirectionX, settings.lightDirectionY, settings.lightDirectionZ);
};

const updateCameraSpeed = (event) => {
  settings.cameraSpeed = event.target.value;
  camera.wheelPrecision = 50 / settings.cameraSpeed;
  camera.angularSensibilityX = 1000 / settings.cameraSpeed;
  camera.angularSensibilityY = 1000 / settings.cameraSpeed;
};

onMounted(() => {
  initBabylonJS();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  engine.stopRenderLoop();
  engine.dispose();
});
</script>

<template>
  <div id="app">
    <input type="file" accept=".stl,.glb,.gltf" @change="handleFileChange" class="file-input" />
    <canvas ref="canvasRef" class="canvas-container"></canvas>
    <div v-if="showErrorModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showErrorModal = false">&times;</span>
        <p class="error-text">{{ errorMessage }}</p>
      </div>
    </div>
    <div class="settings-panel">
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
      </div>
      <div class="setting">
        <label for="cameraSpeed">Camera Speed</label>
        <input class="slider"  type="range" id="cameraSpeed" min="0.1" max="10" step="0.1" v-model="settings.cameraSpeed" @input="updateCameraSpeed" />
        <div class="setting-value">{{ settings.cameraSpeed }}</div>
      </div>
      <div class="setting">
        <label for="cameraRadius">Camera Distance</label>
        <div class="setting-value">{{ settings.cameraRadius }}</div>
      </div>
      <div class="setting">
        <label for="backgroundColor">Background Color</label>
        <input type="color" id="backgroundColor" v-model="settings.backgroundColor" @input="updateBackgroundColor" />
        <div class="setting-value">{{ settings.backgroundColor }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-input {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
}
.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #242424; /* Ensure the background is dark */
}
.modal {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  z-index: 100;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.5);
}
.modal-content {
  background-color: #fefefe;
  margin: auto;
  padding: 20px;
  border: 1px solid #888;
  width: 80%;
  max-width: 500px;
  text-align: center;
}
.close {
  color: #000000;
  float: right;
  font-size: 28px;
  font-weight: bold;
}
.close:hover,
.close:focus {
  color: black;
  text-decoration: none;
  cursor: pointer;
}
.error-warning {
  color: red;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 10px;
}
.error-text {
  color: #000000;
  font-size: 16px;
}
.settings-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(46, 46, 46, 0.438);
  padding: 10px;
  border-radius: 10px;
  z-index: 10;
}
.setting {
  margin-bottom: 10px;
}
.setting label {
  display: block;
  margin-bottom: 5px;
  user-select: none;
}
.setting input[type="range"],
.setting input[type="color"] {
  width: 100%;
}
.setting-value {
  margin-top: 5px;
  font-size: 14px;
  color: #ffffff;
}
.toggle-button {
  margin-top: 10px;
  padding: 5px 10px;
  background-color: #614caf;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.toggle-button:hover {
  background-color: #43337d;
}
.sub-settings {
  margin-top: 10px;
  padding: 10px;
  background-color: rgba(46, 46, 46, 0.438);
  border-radius: 10px;
}
.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  background: #4CAF50; /* Green */
  outline: none;
  opacity: 0.7;
  transition: opacity .2s;
}

.slider:hover {
  opacity: 1;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 15px;
  height: 15px;
  background: #ffffff; /* Green */
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 15px;
  height: 15px;
  background: #5a5e5a; /* Green */
  cursor: pointer;
}
</style>