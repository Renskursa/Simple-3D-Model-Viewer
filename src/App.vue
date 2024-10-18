<template>
  <div id="app">
    <div class="top-right-container">
      <FileUploader @file-loaded="handleFileLoaded" @error="showError" />
      <ToolRack :selectedTool="selectedTool" @tool-selected="updateSelectedTool" />
      <SettingsPanel :settings="settings"
        @update-background-color="updateBackgroundColor" @update-light-intensity="updateLightIntensity"
        @update-light-direction="updateLightDirection" @update-light-color="updateLightColor"
        @update-camera-speed="updateCameraSpeed" @undo-last-action="undoLastAction"
        @update-paint-color="updatePaintColor" @export-model="exportModel"/>
    </div>
    <BabylonScene ref="canvasRef" :settings="settings" :actionStack="actionStack" :undoLastAction="undoLastAction"
      :paintColor="paintColor" @context-initialized="onBabylonInit" :fileUrl="fileUrl" :fileExtension="fileExtension" 
      :selectedTool="selectedTool" @tool-changed="updateSelectedTool" @measurement-completed="handleMeasurementCompleted" />
    <ErrorModal v-if="showErrorModal" :errorMessage="errorMessage" @close="showErrorModal = false" />
  </div>
</template>

<script setup>
import './style.css';
import * as BABYLON from '@babylonjs/core';
import { ref, reactive } from 'vue';
import { GLTF2Export } from '@babylonjs/serializers/glTF';

import FileUploader from './components/FileUploader.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import BabylonScene from './components/BabylonScene.vue';
import ErrorModal from './components/ErrorModal.vue';
import ToolRack from './components/ToolRack.vue';

const canvasRef = ref(null);
const errorMessage = ref('');
const showErrorModal = ref(false);

const settings = reactive({
  lightIntensity: 0.9,
  cameraRadius: 35.71,
  startX: -15,
  startY: 10,
  backgroundColor: '#242424',
  lightColor: '#ffffff',
  lightDirectionX: 0,
  lightDirectionY: 1,
  lightDirectionZ: 0,
  cameraSpeed: 1,
});

const paintColor = ref('#ff0000');
const selectedTool = ref('gizmo');

let graphicsContext = {
  scene: null,
  camera: null,
  light: null,
};

let actionStack = [];

const fileUrl = ref(null);
const fileExtension = ref(null);

const handleFileLoaded = (url, extension) => {
  fileUrl.value = url;
  fileExtension.value = extension;
};

const updatePaintColor = (color) => {
  paintColor.value = color;
};

const onBabylonInit = (initializedContext) => {
  graphicsContext = initializedContext;
  console.log(initializedContext.scene);
};

const undoLastAction = () => {
  if (actionStack.length > 0) {
    const lastAction = actionStack.pop();
    console.log(lastAction);
    switch (lastAction.type) {
      case 'paint':
        const { mesh, faceIndices, originalColors } = lastAction;
        const colorsData = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

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

const updateLightIntensity = (event) => {
  settings.lightIntensity = event.target.value;
  if (graphicsContext.light) {
    graphicsContext.light.intensity = settings.lightIntensity;
  }
};

const updateBackgroundColor = (event) => {
  settings.backgroundColor = event.target.value;
  if (graphicsContext.scene) {
    graphicsContext.scene.clearColor = BABYLON.Color3.FromHexString(settings.backgroundColor);
  }
};

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

const updateLightColor = (event) => {
  settings.lightColor = event.target.value;
  if (graphicsContext.light) {
    graphicsContext.light.diffuse = BABYLON.Color3.FromHexString(settings.lightColor);
  }
};

const updateCameraSpeed = (event) => {
  settings.cameraSpeed = event.target.value;
  if (graphicsContext.camera) {
    graphicsContext.camera.wheelPrecision = 50 / settings.cameraSpeed;
    graphicsContext.camera.angularSensibilityX = 1000 / settings.cameraSpeed;
    graphicsContext.camera.angularSensibilityY = 1000 / settings.cameraSpeed;
  }
};

const showError = (message) => {
  errorMessage.value = message;
  showErrorModal.value = true;
};

const updateSelectedTool = (tool) => {
    selectedTool.value = tool;
    graphicsContext.gizmoManager.positionGizmoEnabled = tool === "gizmo";
    graphicsContext.gizmoManager.rotationGizmoEnabled = tool === "gizmo";
    graphicsContext.gizmoManager.scaleGizmoEnabled = tool === "gizmo";
    console.log(tool);
};

const exportModel = (format = 'glb') => {
    const originalMeshes = graphicsContext.scene.meshes.filter(mesh => !mesh.isHighlightMesh && mesh !== graphicsContext.ground);
    const exportScene = new BABYLON.Scene(graphicsContext.engine);

    originalMeshes.forEach(mesh => {
        const vertexData = BABYLON.VertexData.ExtractFromMesh(mesh);
        const newMesh = new BABYLON.Mesh(mesh.name, exportScene);
        vertexData.applyToMesh(newMesh);
        newMesh.material = mesh.material;
    });

    if (format === 'glb') {
        const fileName = graphicsContext.selectedFile.value ? graphicsContext.selectedFile.value.name.split('.')[0] : 'exported-model';
        GLTF2Export.GLBAsync(exportScene, `${fileName}.glb`).then((glb) => {
            glb.downloadFiles();
        });
    } else if (format === 'fbx') {
        // Add FBX export logic here if available
        console.log("FBX export is not implemented yet.");
    }
};

const handleMeasurementCompleted = (distance) => {
  console.log(`Measured distance: ${distance} mm`);
  // You can add additional logic here to display the distance in the UI or handle it as needed
};
</script>