<script setup>
import { ref, onMounted, onBeforeUnmount, reactive } from 'vue';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, Color3 } from '@babylonjs/core';

const canvasRef = ref(null);
const settings = reactive({
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

  light = new HemisphericLight("light", new Vector3(settings.lightDirectionX, settings.lightDirectionY, settings.lightDirectionZ), scene);

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
  <canvas ref="canvasRef" class="canvas-container"></canvas>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  background-color: #242424;
}
</style>
