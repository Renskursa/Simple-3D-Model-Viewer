<script setup>
import { SceneLoader } from '@babylonjs/core';
import '@babylonjs/loaders/stl';
import '@babylonjs/loaders/glTF';

const loadModel = (file, scene) => {
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
    }, `.${extension}`);
  };
  reader.readAsArrayBuffer(file);
};

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file && (file.name.endsWith('.stl') || file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
    loadModel(file, scene);
  }
};
</script>

<template>
  <input type="file" accept=".stl,.glb,.gltf" @change="handleFileChange" />
</template>

<style scoped>
input {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
}
</style>
