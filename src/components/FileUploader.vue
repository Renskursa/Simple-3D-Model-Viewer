<template>
    <label for="file-input" class="custom-file-input">
    <div class="file-label-content">
        <img src="@/assets/upload-icon.svg" alt="Upload Icon" class="upload-icon" />
        <input type="file" id="file-input" class="file-input" @change="handleFileChange" accept=".stl,.obj" />
        <span v-if="selectedFile">Selected file: {{ selectedFile.name }}</span>
        <span v-else>Choose a file...</span>
    </div>
    </label>
  </template>
  
  <script setup>
  import { ref } from 'vue';

  const emit = defineEmits();
  
  const selectedFile = ref(null);
  
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && (file.name.endsWith('.stl') || file.name.endsWith('.obj'))) {
      selectedFile.value = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target.result;
        const url = URL.createObjectURL(new Blob([arrayBuffer]));
        const extension = file.name.split('.').pop();
        emit('file-loaded', url, extension);
      };
      reader.readAsArrayBuffer(file);
    } else if (file) {
      emit('error', 'Unsupported file format. Please select an STL or OBJ file.');
    }
  };
  </script>
  
  <style>
  .custom-file-input {
    display: inline-block;
    cursor: pointer;
  }
  
  .file-label-content {
    display: flex;
    align-items: center;
  }
  
  .upload-icon {
    width: 24px;
    height: 24px;
    margin-right: 8px;
  }
  
  .file-input {
    display: none;
  }
  </style>