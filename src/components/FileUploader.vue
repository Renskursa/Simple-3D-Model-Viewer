<template>
    <div class="file-uploader">
        <label for="file-input" class="custom-file-input">
            <div class="file-label-content">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" class="upload-icon">
                    <path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" />
                </svg>
                <input type="file" id="file-input" class="file-input" @change="handleFileChange" accept=".stl,.obj,.fbx" />
                <span>{{ selectedFile ? selectedFile.name : 'Upload Model' }}</span>
            </div>
        </label>
    </div>
</template>
  
<script setup>
import { ref } from 'vue';

const emit = defineEmits(['file-loaded', 'error']);
  
const selectedFile = ref(null);
  
const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.stl') || fileName.endsWith('.obj') || fileName.endsWith('.fbx')) {
        selectedFile.value = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            const arrayBuffer = event.target.result;
            const url = URL.createObjectURL(new Blob([arrayBuffer]));
            const extension = file.name.split('.').pop().toLowerCase();
            emit('file-loaded', url, extension);
        };
        reader.readAsArrayBuffer(file);
    } else {
        emit('error', 'Unsupported file format. Please select an STL, OBJ, or FBX file.');
    }
};
</script>
  
<style scoped>
.file-uploader {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.upload-button {
    background-color: rgba(26, 26, 46, 0.8);
    backdrop-filter: blur(8px);
    border: none;
    border-radius: 6px;
    color: white;
    padding: 10px 16px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
}

.upload-button:hover {
    background-color: rgba(36, 36, 56, 0.9);
}

.upload-button svg {
    width: 18px;
    height: 18px;
}

.file-input {
    display: none;
}

.custom-file-input {
    padding: 10px 16px;
    background-color: #0f3460;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    display: inline-block;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
}

.custom-file-input:hover {
    background-color: #16213e;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.file-label-content {
    display: flex;
    align-items: center;
    gap: 8px;
}

.upload-icon {
    flex-shrink: 0;
}

.file-label-content span {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}

/* Mobile styles */
@media (max-width: 768px) {
    .file-uploader {
        top: 10px;
        right: 10px;
    }
    
    .upload-button {
        padding: 8px 12px;
        font-size: 13px;
    }
    
    .upload-button svg {
        width: 16px;
        height: 16px;
    }
}
</style>