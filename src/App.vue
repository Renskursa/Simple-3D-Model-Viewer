<script setup>
import './style.css'
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/stl';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import { GLTF2Export } from '@babylonjs/serializers';
import { GridMaterial } from '@babylonjs/materials/grid';
import { ref, onMounted, onBeforeUnmount, reactive } from 'vue';
import exampleModel from '@/assets/example.stl';

const selectedFile = ref(null);
const canvasRef = ref(null);
const errorMessage = ref('');
const showErrorModal = ref(false);
const showLightSettings = ref(false);
const paintColor = ref('#ff0000');
const isSettingsPanelVisible = ref(true);
const showUncollapseButton = ref(false);

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

const mode = ref('gizmo'); // 'gizmo' or 'paint'

let engine, scene, camera, light, highlightMaterial, glowLayer, ground;
const MIN_CAMERA_RADIUS = 1.5;
let previousHighlightMesh = null;
let createdFaceMeshes = [];
let actionStack = [];
let gizmoManager;

const initBabylonJS = () => {
  // Initialize engine and scene
  engine = new BABYLON.Engine(canvasRef.value, true);
  scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color3.FromHexString(settings.backgroundColor);

  // Initialize camera
  camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, settings.cameraRadius, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvasRef.value, true);
  camera.wheelPrecision = 50 / settings.cameraSpeed;
  camera.angularSensibilityX = 1000 / settings.cameraSpeed;
  camera.angularSensibilityY = 1000 / settings.cameraSpeed;
  camera.setPosition(new BABYLON.Vector3(settings.startX, settings.startY, settings.cameraRadius));

  // Initialize light
  light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(settings.lightDirectionX, settings.lightDirectionY, settings.lightDirectionZ), scene);
  light.intensity = settings.lightIntensity;

  // Initialize materials
  highlightMaterial = new BABYLON.StandardMaterial("highlightMaterial", scene);
  highlightMaterial.diffuseColor = BABYLON.Color3.Magenta();
  highlightMaterial.emissiveColor = BABYLON.Color3.Magenta();
  highlightMaterial.renderingGroupId = 1;
  highlightMaterial.renderingOrder = 1;

  glowLayer = new BABYLON.GlowLayer("glowLayer", scene);
  glowLayer.intensity = 0.4;

  // Initialize gizmo manager
  gizmoManager = new BABYLON.GizmoManager(scene);
  gizmoManager.positionGizmoEnabled = true;
  gizmoManager.scaleGizmoEnabled = true;
  gizmoManager.gizmos.scaleGizmo.scaleRatio = 1.25;

  let initialTransform = null;

  // Track gizmo transformations
  const trackGizmoTransformations = (gizmo) => {
    gizmo.onDragStartObservable.add(() => {
      const mesh = gizmo.attachedMesh;
      if (mesh) {
        initialTransform = {
          position: mesh.position.clone(),
          rotation: mesh.rotation.clone(),
          scaling: mesh.scaling.clone()
        };
      }
    });

    gizmo.onDragEndObservable.add(() => {
      const mesh = gizmo.attachedMesh;
      if (mesh && initialTransform) {
        const finalTransform = {
          position: mesh.position.clone(),
          rotation: mesh.rotation.clone(),
          scaling: mesh.scaling.clone()
        };
        actionStack.push({
          type: 'transform',
          mesh,
          initialTransform,
          finalTransform
        });
      }
    });
  };

  trackGizmoTransformations(gizmoManager.gizmos.positionGizmo);
  trackGizmoTransformations(gizmoManager.gizmos.scaleGizmo);

  // Create ground mesh
  ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);

  // Create grid material
  const gridMaterial = new GridMaterial("gridMaterial", scene);
  gridMaterial.majorUnitFrequency = 5;
  gridMaterial.minorUnitVisibility = 0.45;
  gridMaterial.gridRatio = 1;
  gridMaterial.backFaceCulling = false;
  gridMaterial.mainColor = new BABYLON.Color3(1, 1, 1);
  gridMaterial.lineColor = new BABYLON.Color3(0.5, 0.5, 0.5);
  gridMaterial.opacity = 0.3;

  // Apply grid material to ground
  ground.material = gridMaterial;
  ground.isPickable = false; // Make ground not pickable
  ground.renderingGroupId = 0;

  // Run render loop
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

const loadModel = (url, extension) => {
  // Clear all painted faces before loading a new model
  clearPaintedFaces();

  // Clear the scene before loading a new model, except for the ground
  scene.meshes.filter(mesh => mesh !== ground).forEach(mesh => mesh.dispose());

  BABYLON.SceneLoader.Append("", url, scene, () => {
    scene.meshes.forEach(mesh => {
      if (mesh !== ground) {
        mesh.renderingGroupId = 1;
        mesh.renderingOrder = 0; 
        mesh.hasVertexAlpha = false;
 
        // Enable vertex colors for loaded meshes
        if (!mesh.material) {
        mesh.material = new BABYLON.StandardMaterial("vertexColorMaterial", scene);
        }
        mesh.material.vertexColorsEnabled = true;
        mesh.material.backFaceCulling = true;

        mesh.actionManager = new BABYLON.ActionManager(scene);
        mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
          if (mode.value === 'gizmo') {
            gizmoManager.attachToMesh(mesh);
          }
        }));
      }
    });
    console.log(`${extension.toUpperCase()} model loaded`);
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
  if (mode.value === 'gizmo') {
    return;
  }

  const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
  if (pickResult.hit) {
    const pickedMesh = pickResult.pickedMesh;
    const pickedFaceId = pickResult.faceId;

    // Check if the same face is already highlighted
    if (previousHighlightMesh && previousHighlightMesh.pickedMesh === pickedMesh && previousHighlightMesh.pickedFaceId === pickedFaceId) {
      return;
    }

    if (previousHighlightMesh) {
      glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
      previousHighlightMesh.dispose();
    }

    const indices = pickedMesh.getIndices();
    const vertexData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    // Check if vertexData is valid
    if (!vertexData) {
      return;
    }

    const faceIndices = [
      indices[pickedFaceId * 3],
      indices[pickedFaceId * 3 + 1],
      indices[pickedFaceId * 3 + 2]
    ];

    // Transform the vertex positions using the world matrix of the picked mesh
    const worldMatrix = pickedMesh.getWorldMatrix();
    const transformedPositions = [];
    for (const index of faceIndices) {
      const position = BABYLON.Vector3.FromArray(vertexData, index * 3);
      const transformedPosition = BABYLON.Vector3.TransformCoordinates(position, worldMatrix);
      transformedPositions.push(transformedPosition.x, transformedPosition.y, transformedPosition.z);
    }

    const highlightMesh = new BABYLON.Mesh("highlightMesh", scene);
    highlightMesh.isHighlightMesh = true;
    highlightMesh.pickedMesh = pickedMesh;
    highlightMesh.pickedFaceId = pickedFaceId;

    const highlightVertexData = new BABYLON.VertexData();
    highlightVertexData.positions = transformedPositions;
    highlightVertexData.indices = [0, 1, 2];
    highlightVertexData.applyToMesh(highlightMesh);
    highlightMesh.material = highlightMaterial;
    highlightMesh.renderingGroupId = 1;
    highlightMesh.renderingOrder = 1;
    
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
  const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
  if (pickResult.hit) {
    const pickedMesh = pickResult.pickedMesh;
    const pickedFaceId = pickResult.faceId;
    console.log('Picked face ID:', pickedFaceId);

    if (mode.value === 'paint') {
      const indices = pickedMesh.getIndices();
      const vertexData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      let colorsData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

      // Initialize color data if it doesn't exist
      if (!colorsData) {
        colorsData = new Float32Array(vertexData.length / 3 * 4);
        for (let i = 0; i < vertexData.length / 3; i++) {
          colorsData[i * 4] = 1.0; // R
          colorsData[i * 4 + 1] = 1.0; // G
          colorsData[i * 4 + 2] = 1.0; // B
          colorsData[i * 4 + 3] = 1.0; // A
        }
      }

      const faceIndices = [
        indices[pickedFaceId * 3],
        indices[pickedFaceId * 3 + 1],
        indices[pickedFaceId * 3 + 2]
      ];

      const paintColorArray = BABYLON.Color3.FromHexString(paintColor.value).asArray().concat([1.0]);

      // Store original colors before painting
      const originalColors = faceIndices.map(index => [
        colorsData[index * 4],
        colorsData[index * 4 + 1],
        colorsData[index * 4 + 2],
        colorsData[index * 4 + 3]
      ]);

      if (event.button === 0) { // Left mouse button is pressed
        // Paint the selected face
        faceIndices.forEach(index => {
          colorsData[index * 4] = paintColorArray[0];
          colorsData[index * 4 + 1] = paintColorArray[1];
          colorsData[index * 4 + 2] = paintColorArray[2];
          colorsData[index * 4 + 3] = paintColorArray[3];
        });
      } else if (event.button === 2) { // Right mouse button is pressed
        // Remove the paint from the selected face (reset to white)
        faceIndices.forEach(index => {
          colorsData[index * 4] = 1.0;
          colorsData[index * 4 + 1] = 1.0;
          colorsData[index * 4 + 2] = 1.0;
          colorsData[index * 4 + 3] = 1.0;
        });
      }

      pickedMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorsData);

      // Push the action to the stack
      actionStack.push({ type: 'paint', mesh: pickedMesh, faceIndices, originalColors });

      console.log('Face Painted:', faceIndices);
    }
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
  if (event.key === '1' || event.key === 'q') {
    mode.value = 'gizmo';
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = true;  
    
    if (previousHighlightMesh) {
      glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
      previousHighlightMesh.dispose();
    }
  } else if (event.key === '2' || event.key === 'w') {
    mode.value = 'paint';
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;  
  } else if (event.ctrlKey && event.key === 'z') {
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
          <img src="@/assets/upload-icon.svg" alt="Upload Icon" class="upload-icon" />
          <input type="file" id="file-input" class="file-input" @change="handleFileChange" accept=".stl,.obj" />
          <span v-if="selectedFile">Selected file: {{ selectedFile.name }}</span>
          <span v-else>Choose a file...</span>
        </div>
      </label>
      <transition name="settings-panel" @after-leave="showUncollapseButton = true">
        <div v-show="isSettingsPanelVisible" class="settings-panel">
          <div class="setting minimize-setting">
            <button class="minimize-button" @click="isSettingsPanelVisible = false">
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
            <button class="base-button undo-button" @click="undoLastAction">Undo</button>
          </div>
          <div class="setting">
            <button class="base-button export-button" @click="() => exportModel()">
              <img src="@/assets/download-icon.svg" alt="Download Icon" class="download-icon" />
              Export
            </button>
          </div>
        </div>
      </transition>
      <transition name="uncollapse-button">
        <template v-if="!isSettingsPanelVisible && showUncollapseButton">
          <button class="restore-button" @click="  isSettingsPanelVisible = true; showUncollapseButton = false;">
            <img src="@/assets/uncollapse-right.svg" alt="Uncollapse Right" class="uncollapse-right" />
          </button>
        </template>
      </transition>
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