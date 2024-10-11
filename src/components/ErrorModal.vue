<script setup>
const showErrorModal = defineProps(['showErrorModal', 'errorMessage']);
</script>

<template>
  <div v-if="showErrorModal" class="modal">
    <div class="modal-content">
      <span class="close" @click="$emit('close')">&times;</span>
      <p>{{ errorMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}
</style>
