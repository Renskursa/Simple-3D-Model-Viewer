<template>
  <div id="app">
    <div class="interface-container">
      <FileUploader @file-loaded="handleFileLoaded" @error="showError" />
      <ToolRack 
        :selectedTool="selectedTool" 
        :enableSnapping="enableSnapping" 
        :paintColor="paintColor"
        @tool-selected="updateSelectedTool" 
        @toggle-snapping="updateSnappingMode"
        @update-paint-color="updatePaintColor"
        @tool-changed="updateSelectedTool"
      />
      <SettingsPanel :settings="settings" :enableTransforms="enableTransforms"
        @update-background-color="updateBackgroundColor" @update-light-intensity="updateLightIntensity"
        @update-light-direction="updateLightDirection" @update-light-color="updateLightColor"
        @update-camera-speed="updateCameraSpeed" @undo-last-action="undoLastAction"
        @export-model="exportModel"
        @update-transform="updateTransform"/>
    </div>
    <BabylonScene ref="canvasRef" :settings="settings" :actionStack="actionStack" :undoLastAction="undoLastAction"
      :paintColor="paintColor" @context-initialized="onBabylonInit" :fileUrl="fileUrl" :fileExtension="fileExtension" 
      :selectedTool="selectedTool" :enableSnapping="enableSnapping" @tool-changed="updateSelectedTool" @measurement-completed="handleMeasurementCompleted"
      @enable-transform-input="enableTransformInput" @update-transform-from-gizmo = "updateTransformFromGizmo"/>
    <ErrorModal v-if="showErrorModal" :errorMessage="errorMessage" @close="showErrorModal = false" />
  </div>
</template>

<script setup>
import './style.css';
import * as BABYLON from '@babylonjs/core';
import { ref, reactive, watch } from 'vue';
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
  backgroundColor: '#1a1a2e',
  lightColor: '#ffffff',
  lightDirectionX: 0,
  lightDirectionY: 1,
  lightDirectionZ: 0,
  cameraSpeed: 1,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scalingX: 1,
  scalingY: 1,
  scalingZ: 1,
});

const paintColor = ref('#ff0000');
const selectedTool = ref('gizmo');
const enableSnapping = ref(true);
const enableTransforms = ref(false);

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
};

const undoLastAction = () => {
  if (actionStack.length > 0) {
    const lastAction = actionStack.pop();
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
        syncSettingsWithMesh(transformedMesh);
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

const enableTransformInput = (enable) => {
  enableTransforms.value = enable;
};

const updateTransformFromGizmo = (type, axis, value) => {
    settings[`${type}${axis.toUpperCase()}`] = value;
};

const updateTransform = (type, axis, value) => {
  const mesh = graphicsContext.gizmoManager.gizmos.positionGizmo.attachedMesh;

  if (!mesh) {
    console.error("No mesh is attached to the gizmo.");
    return;
  }

  const initialTransform = {
    position: mesh.position.clone(),
    rotation: mesh.rotation.clone(),
    scaling: mesh.scaling.clone()
  };

  actionStack.push({ type: 'transform', mesh, initialTransform });

  if (!mesh[type]) {
    console.error(`Mesh does not have a property '${type}'`);
    return;
  }

  if (typeof mesh[type][axis.toLowerCase()] === 'undefined') {
    console.error(`Mesh property '${type}' does not have an axis '${axis}'`);
    return;
  }

  mesh[type][axis.toLowerCase()] = parseFloat(value);
  syncSettingsWithMesh(mesh);
};

const syncSettingsWithMesh = (mesh) => {
  settings.positionX = mesh.position.x;
  settings.positionY = mesh.position.y;
  settings.positionZ = mesh.position.z;
  settings.rotationX = mesh.rotation.x;
  settings.rotationY = mesh.rotation.y;
  settings.rotationZ = mesh.rotation.z;
  settings.scalingX = mesh.scaling.x;
  settings.scalingY = mesh.scaling.y;
  settings.scalingZ = mesh.scaling.z;
};

const updateSelectedTool = (tool) => {
  selectedTool.value = tool;
  graphicsContext.gizmoManager.positionGizmoEnabled = tool === "gizmo";
  graphicsContext.gizmoManager.rotationGizmoEnabled = tool === "gizmo";
  graphicsContext.gizmoManager.scaleGizmoEnabled = tool === "gizmo";
};

const updateSnappingMode = (enable) => {
  enableSnapping.value = enable;
  graphicsContext.gizmoManager.snapDistance = enable ? 0.1 : 0;
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
  console.log(`Measured distance: ${distance} m`);
  // You can add additional logic here to display the distance in the UI or handle it as needed
};

// Watchers for transform properties
watch(() => settings.positionX, (newValue) => {
  updateTransform('position', 'x', newValue);
});

watch(() => settings.positionY, (newValue) => {
  updateTransform('position', 'y', newValue);
});

watch(() => settings.positionZ, (newValue) => {
  updateTransform('position', 'z', newValue);
});

watch(() => settings.rotationX, (newValue) => {
  updateTransform('rotation', 'x', newValue);
});

watch(() => settings.rotationY, (newValue) => {
  updateTransform('rotation', 'y', newValue);
});

watch(() => settings.rotationZ, (newValue) => {
  updateTransform('rotation', 'z', newValue);
});

watch(() => settings.scalingX, (newValue) => {
  updateTransform('scaling', 'x', newValue);
});

watch(() => settings.scalingY, (newValue) => {
  updateTransform('scaling', 'y', newValue);
});

watch(() => settings.scalingZ, (newValue) => {
  updateTransform('scaling', 'z', newValue);
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', 'Avenir', Helvetica, Arial, sans-serif;
  background-color: #1a1a2e;
  color: white;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.interface-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  pointer-events: none;
}

.interface-container > * {
  pointer-events: auto;
}

/* Mobile styles */
@media (max-width: 768px) {
  .interface-container {
    display: flex;
    flex-direction: column;
  }
}
</style>