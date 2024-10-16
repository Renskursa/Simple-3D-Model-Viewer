<template>
  <div id="app">
    <div class="top-right-container">
      <FileUploader @file-loaded="handleFileLoaded" @error="showError" />
      <SettingsPanel :settings="settings"
        @update-background-color="updateBackgroundColor" @update-light-intensity="updateLightIntensity"
        @update-light-direction="updateLightDirection" @update-light-color="updateLightColor"
        @update-camera-speed="updateCameraSpeed" @undo-last-action="undoLastAction"
        @update-paint-color="updatePaintColor" />
    </div>
    <BabylonScene ref="canvasRef" :settings="settings" :actionStack="actionStack" :undoLastAction="undoLastAction"
      :paintColor="paintColor" @context-initialized="onBabylonInit" :fileUrl="fileUrl" :fileExtension="fileExtension" />
    <ErrorModal v-if="showErrorModal" :errorMessage="errorMessage" @close="showErrorModal = false" />
  </div>
</template>

<script setup>
import './style.css';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/stl';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import { ref, reactive } from 'vue';

import FileUploader from './components/FileUploader.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import BabylonScene from './components/BabylonScene.vue';
import ErrorModal from './components/ErrorModal.vue';

const canvasRef = ref(null);
const errorMessage = ref('');
const showErrorModal = ref(false);

const settings = reactive({
  lightIntensity: 0.7,
  cameraRadius: 35.71,
  startX: -15,
  startY: 10,
  backgroundColor: '#242424',
  lightColor: '#ffffff',
  lightDirectionX: 1,
  lightDirectionY: 1,
  lightDirectionZ: 0,
  cameraSpeed: 1,
});

const paintColor = ref('#ff0000');

let graphicsContext = {
  scene: null,
  camera: null,
  light: null,
};

let actionStack = [];

const fileUrl = ref(null);
const fileExtension = ref(null);

// Function to handle file loaded event
const handleFileLoaded = (url, extension) => {
  fileUrl.value = url;
  fileExtension.value = extension;
};

// Function to handle paint color update
const updatePaintColor = (color) => {
  paintColor.value = color;
};

// Function to handle scene initialization
const onBabylonInit = (initializedContext) => {
  graphicsContext = initializedContext;
  console.log(initializedContext.scene);
};

// Function to undo the last action
const undoLastAction = () => {
  if (actionStack.length > 0) {
    const lastAction = actionStack.pop();
    console.log(lastAction);
    switch (lastAction.type) {
      case 'paint':
        const { mesh, faceIndices, originalColors } = lastAction;
        const colorsData = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

        // Restore original colors
        faceIndices.forEach((index, i) => {
          colorsData[index * 4] = originalColors[i][0];
          colorsData[index * 4 + 1] = originalColors[i][1];
          colorsData[index * 4 + 2] = originalColors[i][2];
          colorsData[index * 4 + 3] = originalColors[i][3];
        });

        mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorsData);
        mesh.material.vertexColorsEnabled = true;
        mesh.material.backFaceCulling = true;
        break;
      case 'transform':
        const { mesh: transformedMesh, initialTransform } = lastAction;
        transformedMesh.position = initialTransform.position;
        transformedMesh.rotation = initialTransform.rotation;
        transformedMesh.scaling = initialTransform.scaling;
        break;
    }
  }
};

// Function to update light intensity
const updateLightIntensity = (event) => {
  settings.lightIntensity = event.target.value;
  if (graphicsContext.light) {
    graphicsContext.light.intensity = settings.lightIntensity;
  }
};

// Function to update background color
const updateBackgroundColor = (event) => {
  settings.backgroundColor = event.target.value;
  if (graphicsContext.scene) {
    graphicsContext.scene.clearColor = BABYLON.Color3.FromHexString(settings.backgroundColor);
  }
};

// Function to update light direction
const updateLightDirection = (axis, value) => {
  settings[`lightDirection${axis}`] = value;
  if (graphicsContext.light) {
    graphicsContext.light.direction = new BABYLON.Vector3(
      settings.lightDirectionX,
      settings.lightDirectionY,
      settings.lightDirectionZ
    );
  }
};

// Function to update light color
const updateLightColor = (event) => {
  settings.lightColor = event.target.value;
  if (graphicsContext.light) {
    graphicsContext.light.diffuse = BABYLON.Color3.FromHexString(settings.lightColor);
  }
};

// Function to update camera speed
const updateCameraSpeed = (event) => {
  settings.cameraSpeed = event.target.value;
  if (camera) {
    camera.wheelPrecision = 50 / settings.cameraSpeed;
    camera.angularSensibilityX = 1000 / settings.cameraSpeed;
    camera.angularSensibilityY = 1000 / settings.cameraSpeed;
  }
};

const showError = (message) => {
  errorMessage.value = message;
  showErrorModal.value = true;
};
</script>