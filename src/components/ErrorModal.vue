<template>
  <div class="modal">
    <div class="modal-content popup">
      <span class="close" @click="$emit('close')">&times;</span>
      <p class="error-warning">An error has occured:</p>
      <p class="error-text">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  errorMessage: String,
});
</script>

<style scoped>
.popup {
  animation: popup 0.3s ease-out;
}

@keyframes popup {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }

  70% {
    transform: scale(1.1);
    opacity: 1;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>