<script setup>
import './style.css'
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/stl';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import { GLTF2Export } from '@babylonjs/serializers';
import { ref, onMounted, onBeforeUnmount, reactive } from 'vue';
import exampleModel from '@/assets/example.stl';

const selectedFile = ref(null);
const canvasRef = ref(null);
const errorMessage = ref('');
const showErrorModal = ref(false);
const showLightSettings = ref(false);
const paintColor = ref('#ff0000');
const isSettingsPanelVisible = ref(true); // New state for settings panel visibility

const settings = reactive({
  lightIntensity: 0.7,
  cameraRadius: 35.71,
  startX: -15,
  startY: 10,
  backgroundColor: '#242424',
  lightDirectionX: 1,
  lightDirectionY: 1,
  lightDirectionZ: 0,
  cameraSpeed: 1,
});

let engine, scene, camera, light, highlightMaterial, glowLayer;
const MIN_CAMERA_RADIUS = 1.5;
let previousHighlightMesh = null;
let createdFaceMeshes = [];
let actionStack = [];

// Initializations
const initBabylonJS = () => {
  engine = new BABYLON.Engine(canvasRef.value, true);
  scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color3.FromHexString(settings.backgroundColor);

  camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, settings.cameraRadius, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvasRef.value, true);
  camera.wheelPrecision = 50 / settings.cameraSpeed;
  camera.angularSensibilityX = 1000 / settings.cameraSpeed;
  camera.angularSensibilityY = 1000 / settings.cameraSpeed;
  camera.setPosition(new BABYLON.Vector3(settings.startX, settings.startY, settings.cameraRadius));

  light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(settings.lightDirectionX, settings.lightDirectionY, settings.lightDirectionZ), scene);
  light.intensity = settings.lightIntensity;

  highlightMaterial = new BABYLON.StandardMaterial("highlightMaterial", scene);
  highlightMaterial.diffuseColor = BABYLON.Color3.Magenta();
  highlightMaterial.emissiveColor = BABYLON.Color3.Magenta();

  glowLayer = new BABYLON.GlowLayer("glowLayer", scene);
  glowLayer.intensity = 0.4;

  engine.runRenderLoop(() => {
    if (camera.radius < MIN_CAMERA_RADIUS) {
      camera.radius = MIN_CAMERA_RADIUS;
    }
    settings.cameraRadius = parseFloat(camera.radius.toFixed(2));
    scene.render();
  });

  window.addEventListener('resize', handleResize);
  scene.onPointerMove = handlePointerMove;
  scene.onPointerDown = handlePointerDown;
};

const handleResize = () => {
  engine.resize();
};

const clearPaintedFaces = () => {
  createdFaceMeshes.forEach(mesh => mesh.dispose());
  createdFaceMeshes = [];
};

const undoLastAction = () => {
  if (actionStack.length > 0) {
    const lastAction = actionStack.pop();
    if (lastAction.type === 'paint') {
      lastAction.mesh.dispose();
    }
  }
};

const loadModel = (url, extension) => {
  // Clear all painted faces before loading a new model
  clearPaintedFaces();

  // Clear the scene before loading a new model
  scene.meshes.forEach(mesh => mesh.dispose());

  BABYLON.SceneLoader.Append("", url, scene, (newScene) => {
    console.log(`${extension.toUpperCase()} model loaded:`, newScene);
  }, null, (message, exception) => {
    console.error(message, exception);
    errorMessage.value = message;
    showErrorModal.value = true;
  }, `.${extension}`);
};

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file && (file.name.endsWith('.stl') || file.name.endsWith('.obj'))) {
    selectedFile.value = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const url = URL.createObjectURL(new Blob([arrayBuffer]));
      const extension = file.name.split('.').pop();
      loadModel(url, extension);
    };
    reader.readAsArrayBuffer(file);
  } else if (file) {
    errorMessage.value = 'Unsupported file format. Please select an STL or OBJ file.';
    showErrorModal.value = true;
  }
};

const updateLightIntensity = (event) => {
  settings.lightIntensity = event.target.value;
  light.intensity = settings.lightIntensity;
};

const updateBackgroundColor = (event) => {
  settings.backgroundColor = event.target.value;
  scene.clearColor = BABYLON.Color3.FromHexString(settings.backgroundColor);
};

const updateLightDirection = (axis, value) => {
  settings[`lightDirection${axis}`] = value;
  light.direction = new BABYLON.Vector3(settings.lightDirectionX, settings.lightDirectionY, settings.lightDirectionZ);
};

const updateCameraSpeed = (event) => {
  settings.cameraSpeed = event.target.value;
  camera.wheelPrecision = 50 / settings.cameraSpeed;
  camera.angularSensibilityX = 1000 / settings.cameraSpeed;
  camera.angularSensibilityY = 1000 / settings.cameraSpeed;
};

const handlePointerMove = () => {
  const pickResult = scene.pick(scene.pointerX, scene.pointerY);
  if (pickResult.hit) {
    const pickedMesh = pickResult.pickedMesh;
    const pickedFaceId = pickResult.faceId;

    // Remove previous highlight
    if (previousHighlightMesh) {
      glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
      previousHighlightMesh.dispose();
    }

    const indices = pickedMesh.getIndices();
    const vertexData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const faceIndices = [
      indices[pickedFaceId * 3],
      indices[pickedFaceId * 3 + 1],
      indices[pickedFaceId * 3 + 2]
    ];

    // Create a new mesh for the highlighted face
    const highlightMesh = new BABYLON.Mesh("highlightMesh", scene);
    highlightMesh.isHighlightMesh = true; // Mark as non-exportable

    const highlightVertexData = new BABYLON.VertexData();
    highlightVertexData.positions = [
      vertexData[faceIndices[0] * 3], vertexData[faceIndices[0] * 3 + 1], vertexData[faceIndices[0] * 3 + 2],
      vertexData[faceIndices[1] * 3], vertexData[faceIndices[1] * 3 + 1], vertexData[faceIndices[1] * 3 + 2],
      vertexData[faceIndices[2] * 3], vertexData[faceIndices[2] * 3 + 1], vertexData[faceIndices[2] * 3 + 2]
    ];
    highlightVertexData.indices = [0, 1, 2];
    highlightVertexData.applyToMesh(highlightMesh);
    highlightMesh.material = highlightMaterial;
    glowLayer.addIncludedOnlyMesh(highlightMesh);
    previousHighlightMesh = highlightMesh;
  } else {
    // Remove highlight if no mesh is picked
    if (previousHighlightMesh) {
      glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
      previousHighlightMesh.dispose();
      previousHighlightMesh = null;
    }
  }
};

const handlePointerDown = (event) => {
  const pickResult = scene.pick(scene.pointerX, scene.pointerY);
  if (pickResult.hit) {
    const pickedMesh = pickResult.pickedMesh;
    const pickedFaceId = pickResult.faceId;
    console.log('Picked face ID:', pickedFaceId);

    const indices = pickedMesh.getIndices();
    const vertexData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const faceIndices = [
      indices[pickedFaceId * 3],
      indices[pickedFaceId * 3 + 1],
      indices[pickedFaceId * 3 + 2]
    ];

    // Create a new mesh for the selected face
    const faceMesh = new BABYLON.Mesh("faceMesh", scene);
    const faceVertexData = new BABYLON.VertexData();
    faceVertexData.positions = [
      vertexData[faceIndices[0] * 3], vertexData[faceIndices[0] * 3 + 1], vertexData[faceIndices[0] * 3 + 2],
      vertexData[faceIndices[1] * 3], vertexData[faceIndices[1] * 3 + 1], vertexData[faceIndices[1] * 3 + 2],
      vertexData[faceIndices[2] * 3], vertexData[faceIndices[2] * 3 + 1], vertexData[faceIndices[2] * 3 + 2]
    ];
    faceVertexData.indices = [0, 1, 2];
    faceVertexData.applyToMesh(faceMesh);

    if (event.button === 0) { // Left mouse button is pressed
      const paintMaterial = new BABYLON.StandardMaterial("paintMaterial", scene);
      paintMaterial.diffuseColor = BABYLON.Color3.FromHexString(paintColor.value);
      faceMesh.material = paintMaterial;
    } else if (event.button === 2) { // Right mouse button is pressed
      const originalMaterial = new BABYLON.StandardMaterial("originalMaterial", scene);
      originalMaterial.diffuseColor = BABYLON.Color3.White(); // Assuming the original color is white
      faceMesh.material = originalMaterial;
    }

    // Add the created face mesh to the array
    createdFaceMeshes.push(faceMesh);

    // Push the action to the stack
    actionStack.push({ type: 'paint', mesh: faceMesh });
  }
};

const exportModel = (format = 'glb') => {
  const originalMeshes = scene.meshes.filter(mesh => !mesh.isHighlightMesh);
  const exportScene = new BABYLON.Scene(engine);
  originalMeshes.forEach(mesh => {
    const vertexData = BABYLON.VertexData.ExtractFromMesh(mesh);
    const newMesh = new BABYLON.Mesh(mesh.name, exportScene);
    vertexData.applyToMesh(newMesh);
    newMesh.material = mesh.material;
  });

  if (format === 'glb') {
    const fileName = selectedFile.value ? selectedFile.value.name.split('.')[0] : 'exported-model';
    GLTF2Export.GLBAsync(exportScene, `${fileName}.glb`).then((glb) => {
      glb.downloadFiles();
    });
  } else if (format === 'fbx') {
    // Add FBX export logic here if available
    console.log("FBX export is not implemented yet.");
  }
};

const handleKeyDown = (event) => {
  if (event.ctrlKey && event.key === 'z') {
    undoLastAction();
  }
};

onMounted(() => {
  initBabylonJS();
  loadModel(exampleModel, 'stl'); // Load the example STL file on initial load
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  engine.stopRenderLoop();
  engine.dispose();
});
</script>

<template>
  <div id="app">
    <div class="top-right-container">
      <label for="file-input" class="custom-file-input">
        <div class="file-label-content">
          <img src="@/assets/download-icon.svg" alt="Download Icon" class="download-icon" />
          <input type="file" id="file-input" class="file-input" @change="handleFileChange" accept=".stl,.obj" />
          <span v-if="selectedFile">Selected file: {{ selectedFile.name }}</span>
          <span v-else>Choose a file...</span>
        </div>
      </label>
      <transition name="settings-panel">
        <div v-if="isSettingsPanelVisible" class="settings-panel">
          <div class="setting minimize-setting">
            <button class="minimize-button" @click="isSettingsPanelVisible = false">Minimize</button>
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
            <input type="color" id="paintColor" v-model="paintColor" />
            <div class="setting-value">{{ paintColor }}</div>
          </div>
          <div class="setting">
            <button class="button undo-button" @click="undoLastAction">Undo</button>
          </div>
          <div class="setting">
            <button class="button export-button" @click="() => exportModel()">Export</button>
          </div>
        </div>
      </transition>
      <template v-if="!isSettingsPanelVisible">
        <button class="restore-button" @click="isSettingsPanelVisible = true">
          <div class="hamburger-icon">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </button>
      </template>
    </div>
    <canvas ref="canvasRef" class="canvas-container"></canvas>
    <div v-if="showErrorModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showErrorModal = false">&times;</span>
        <p class="error-warning">Error Occured:</p>
        <p class="error-text">{{ errorMessage }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-right-container {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.minimize-setting {
  position: relative;
  width: 100%;
  padding-bottom: 24px; 
}

.minimize-button {
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
  background-color: #333; /* Darker background */
  color: #fff; /* White text */
  border: 2px solid #444; /* Darker border */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  position: absolute;
  right: 0;
}

.restore-button {
  background-color: #333; /* Darker background */
  color: #fff; /* White text */
  border: 2px solid #444; /* Darker border */
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.restore-button:hover {
  background-color: #444; /* Slightly lighter background */
}

.hamburger-icon {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 20px;
  height: 15px;
  box-sizing: border-box;
}

.hamburger-icon div {
  background-color: #fff; /* White */
  height: 2px;
  width: 100%;
  box-sizing: border-box;
}

.file-input {
  display: none;
}

.custom-file-input {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border: 1px solid #6a0dad; /* Purple */
  border-radius: 5px;
  background-color: #6a0dad;
  color: white;
  cursor: pointer;
  margin-bottom: 10px;
}

.file-label-content {
  display: flex;
  align-items: center;
  user-select: none;
}

.custom-file-input span {
  margin-right: 1px;
}

.custom-file-input p {
  margin: 0;
}

.custom-file-input:hover {
  background-color: #5a0cad; /* Darker Purple */
}

.download-icon {
  width: 32px;
  height: 32px;
  padding-right: 1px
}

canvas {
  outline: none;
}

.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #242424;
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
  padding: 20px;
  border: 1px solid #888;
  border-radius: 30px;
  max-width: 80%;
  height: auto;
  width: auto;
  margin: 0 auto;
  position: relative;
}
.close {
  color: #000000;
  font-size: 28px;
  font-weight: bold;
  position: absolute;
  top: 0;
  right: 0;
  margin-right: 15px;
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
}
.error-text {
  color: #000000;
  font-size: 16px;
}
.settings-panel {
  position: absolute;
  top: 55px;
  right: 0;
  width: 200px;
  background-color: rgba(58, 58, 58, 0.438);
  padding: 10px;
  border-radius: 10px;
  border: 4px #000000 groove;
  z-index: 10;
}
.setting {
  margin-bottom: 10px;
  user-select: none;
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
  width: 100%;
  background-color: #614caf; /* Purple */
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.toggle-button:hover {
  background-color: #43337d; /* Dark-Purple */
}

.button {
  margin-top: 5px;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
  background-color: #333; /* Darker background */
  color: #fff; /* White text */
  border: 2px solid #444; /* Darker border */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.undo-button {
  background-color: #8b0000; /* Dark Red */
  color: white;
  border: 2px solid #5a0000; /* Even darker red */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); /* Darker shadow */
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.undo-button:hover {
  background-color: #5a0000; /* Even darker red */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4); /* Darker shadow */
}

.export-button {
  background-color: #006400; /* Dark Green */
  color: white;
  width: 100%;
  border: 2px solid #004d00; /* Darker green */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.export-button:hover {
  background-color: #004d00; /* Even darker green */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}
.sub-settings {
  margin-top: 10px;
  margin-bottom: 15px;
  height: 255px;
  padding: 10px;
  background-color: rgba(65, 65, 65, 0.495);
  border-radius: 10px;
}
.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  background: #a16c6c; /* Light-Red */
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
  width: 10px;
  height: 15px;
  background: #ff0f0f; /* Red */
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 15px;
  height: 15px;
  background: #5a5e5a; /* Gray */
  cursor: pointer;
}
.settings-panel-enter-active, .settings-panel-leave-active {
  transition: transform 0.4s ease;
}

.settings-panel-enter, .settings-panel-leave-to /* .settings-panel-leave-active in <2.1.8 */ {
  transform: translateX(110%);
}
</style>